/**
 * JavaScript implementation of PyDRT
 * (https://github.com/robertleonhardt/PyDRT; check out for a more detailed documentation)
 * 
 * @version: AA-20260128
 * @code:    Robert Leonhardt - mail@robertleonhardt.de
 */

// const Matrix = mlMatrix.Matrix; // already handled by the nnls solver

class DRT {

    constructor(frequencyData, impedanceData, options = {}) {
        // Store input data
        this.inputFrequencyData = frequencyData;
        this.inputImpedanceData = impedanceData; // expects { re: [], im: [] } as input

        // Store configuration
        // NOTE: Defaults are defined here
        this.epsilon = options.epsilon ?? false; // Niemand hat die Absicht, zu regularisieren

        // Tau range, for which the DRT is computed
        this.tauRangeMin = options.tauRangeMin ?? 1e-6;
        this.tauRangeMax = options.tauRangeMax ?? 1e6;
        this.tauRangePointsPerDecade = options.tauRangePointsPerDecade ?? 30; // The more, the slower the computation but the smoother the DRT
        
        // Tau range, in which signals are considered (outside that, the peaks will be omitted)
        // (should consequently be narrower than the tau range above)
        this.tauMin = options.tauMin ?? 1e-6;
        this.tauMax = options.tauMax ?? 1e6;

        this.solvingData = options.solvingData ?? 'both' // Alternatively: 'real', 'imag'
        const solveOnStart = options.solve ?? true;

        // Sort data in ascending order
        if (this.inputFrequencyData[0] < this.inputFrequencyData[1]) {
            this.inputFrequencyData.reverse();
            this.inputImpedanceData.re.reverse();
            this.inputImpedanceData.im.reverse();
        }

        // Copy the sorted data again, since having a backup might be handy later on
        this._origInputFrequencyData = this.inputFrequencyData;
        this._origInputImpedanceData = this.inputImpedanceData;

        // Get the Ohmic resistance of the impedance data
        // slice().reverse() returns a copied, flipped version of the data
        // This is nessecary as the author still is not capable of interpreting in ascending data
        // The copying (slice()) ensure that we won't permanently re-sort the data
        this.ohmicResistance = this._interp(0, this.inputImpedanceData.im.slice().reverse(), this.inputImpedanceData.re.slice().reverse());
        
        // Subtract the Ohmic resistance and finally store the data
        // After this point, only this.impedanceData should be altered
        this.frequencyData = this.inputFrequencyData;
        this.impedanceData = { 
            re: this.inputImpedanceData.re.map(z => z - this.ohmicResistance),
            im: this.inputImpedanceData.im
        }

        // Remove the inductive part, which we not consider in the classic DRT
        const inductionMask = this.impedanceData.im.map(v => v <= 0);
        this.frequencyData = this.frequencyData.filter((_, i) => inductionMask[i]);
        this.impedanceData = {
            re: this.impedanceData.re.filter((_, i) => inductionMask[i]),
            im: this.impedanceData.re.filter((_, i) => inductionMask[i])
        }

        // TD: Include diffusion offset algorithm from PyDRT

        // Setup time constant range
        this.setupTimeConstants();

        if (solveOnStart) {
            this.solve();
        }

    }

    setupTimeConstants(options = {}) {
        // Config the tau range
        const tauRangeMin = options.tauRangeMin ?? this.tauRangeMin;
        const tauRangeMax = options.tauRangeMax ?? this.tauRangeMax;
        const tauRangePointsPerDecade = options.tauRangePointsPerDecade ?? this.tauRangePointsPerDecade;

        // Calculate the decades and number of points
        const numDecades = Math.log10(tauRangeMax) - Math.log10(tauRangeMin);
        const numPoints = Math.ceil(numDecades * tauRangePointsPerDecade) + 1;

        // Setup and populate time constants
        this.tau = [];
        this.lnTauOverTau0 = []; // This effectively is s in the corresponding publication

        for (let i = 0; i < numPoints; i++) {
            const logTau = Math.log10(tauRangeMin) + (i / tauRangePointsPerDecade);
            const tau = Math.pow(10, logTau);
            this.tau.push(tau);
            this.lnTauOverTau0.push(Math.log(tau));
        }

        return this; // Chaining
    }

    solve(options = {}) {
        // Config the solver
        const solvingData = options.solvingData ?? this.solvingData;
        const epsilon = options.epsilon ?? this.epsilon;

        // Get basic RC matrix and basis matrix
        this.rcKernelMatrix = this._getRCKernelMatrix();
        this.basisMatrix = this._getBasisMatrix();
    }

    _getRCKernelMatrix() {
        // Calculate difference between two time constants (Δln𝜏)
        // This is put into the kernel for convenience 
        // NOTE: ln(a/b) = ln(a) - ln(b)
        const deltaLnTau = Math.log(this.tau[1]) - Math.log(this.tau[0])

        // Build kernel (separated, as js don't know about complex numbers)
        // Thus: 1 / (1 + (ωτ)²) (real) and -ωτ / (1 + (ωτ)²) (imag)
        const kernelRe = [];
        const kernelIm = [];

        for (const f of this.frequencyData) {
            const rowRe = [];
            const rowIm = [];
            const omega = 2 * Math.PI * f;

            for (const t of this.tau) {
                const omegaTau = omega * t;
                const denom = 1 + omegaTau * omegaTau;

                rowRe.push(deltaLnTau / denom);
                rowIm.push(-deltaLnTau * omegaTau / denom);
            }

            kernelRe.push(rowRe);
            kernelIm.push(rowIm);
        }

        return { re: kernelRe, im: kernelIm }
    }

    _getBasisMatrix() {
        throw new Error('_get_basis_matrix() must be implemented by subclass');
    }

    _interp(x, xp, fp) {
        // For edge cases
        if (x <= xp[0]) {
            return fp[0];
        }
        if (x >= xp[xp.length -1]) {
            return fp[fp.length -1];
        }

        // Find bracketing index
        let i = 0;
        while (xp[i + 1] < x) {
            i++;
        }

        // Linear interpolation
        const t = (x - xp[i]) / (xp[i + 1] - xp[i]);
        return fp[i] + t * (fp[i + 1] - fp[i]);
    }

}

class ColeColeDRT extends DRT {

    constructor(frequencyData, impedanceData, options = {}) {
        // Go, call your parents
        super(frequencyData, impedanceData, options);

        // Store config
        this.alpha = options.alpha ?? 0.92;
    }

    _getBasisMatrix() {
        const numTau = this.tau.length;

        // Setup basis matrix
        // This equation was taken from Boukamp, B. A. and A. Rolle (2018). "Use of a distribution function of relaxation times (DFRT) in impedance analysis of SOFC electrodes." 
        // Solid State Ionics 314: 103-111. (https://doi.org/10.1016/j.ssi.2017.11.021)
        const B = Matrix.zeros(numTau, numTau);

        const sinPiAlpha = Math.sin(Math.PI * this.alpha);
        const cosPiAlpha = Math.cos(Math.PI * this.alpha);

        for (let i = 0; i < numTau; i++) {
            for (let j = 0; j < numTau; j++) {
                const lnTauDiff = this.lnTauOverTau0[i] - this.lnTauOverTau0[j];
                const denom = Math.cosh(this.alpha * lnTauDiff) + cosPiAlpha;
                const basis = (1 / (2 * Math.PI)) * sinPiAlpha / denom;

                B.set(i, j, this.alpha);
            }
        }

        return B;
    }

}
/**
 * JavaScript implementation of PyDRT
 * (https://github.com/robertleonhardt/PyDRT)
 */

// const Matrix = mlMatrix.Matrix; // already handled by the nnls solver


class DRT {
    // Data source constants (matching PyDRT)
    static COMBINED = 0;
    static REAL = 1;
    static IMAG = 2;

    // Default configuration
    static DEFAULT_TAU_RANGE_MIN_S = 1e-6;
    static DEFAULT_TAU_RANGE_MAX_S = 1e6;
    static DEFAULT_TAU_POINTS_PER_DECADE = 30;

    /**
     * @param {number[]} frequency_Hz - Frequency array in Hz
     * @param {number[]} impedance_Ohm - Complex impedance as {re: [], im: []} or Complex[]
     * @param {object} options - Configuration options
     * @param {boolean} options.solve - Solve immediately (default: true)
     * @param {number} options.tau_range_min_s - Minimum tau for discretization
     * @param {number} options.tau_range_max_s - Maximum tau for discretization  
     * @param {number} options.tau_points_per_decade - Points per decade
     * @param {number} options.tau_min_s - Lower boundary for solving
     * @param {number} options.tau_max_s - Upper boundary for solving
     * @param {number|false} options.epsilon - Tikhonov regularization parameter
     * @param {number} options.solving_data - Which data to use (COMBINED, REAL, IMAG)
     * @param {number|false} options.diffusion_offset - Trim diffusion artifacts
     */
    constructor(frequency_Hz, impedance_Ohm, options = {}) {
        // Store raw input data
        this._frequency_Hz = [...frequency_Hz];
        this._impedance_Ohm = this._parseImpedance(impedance_Ohm);
        
        // Configuration with defaults
        this._tau_range_min_s = options.tau_range_min_s ?? DRT.DEFAULT_TAU_RANGE_MIN_S;
        this._tau_range_max_s = options.tau_range_max_s ?? DRT.DEFAULT_TAU_RANGE_MAX_S;
        this._tau_points_per_decade = options.tau_points_per_decade ?? DRT.DEFAULT_TAU_POINTS_PER_DECADE;
        
        this._tau_min_s = options.tau_min_s ?? null;
        this._tau_max_s = options.tau_max_s ?? null;
        this._epsilon = options.epsilon ?? false;
        this._solving_data = options.solving_data ?? DRT.COMBINED;
        this._diffusion_offset = options.diffusion_offset ?? false;

        // Internal state (populated by solve)
        this._tau_s = null;
        this._ln_tau_tau0 = null;
        this._weight_vector = null;
        this._weight_hat_Ohm = null;
        this._R_offset_Ohm = 0;
        this._z_back_Ohm = null;
        this._resnorm_Ohm = null;

        // Preprocess impedance data
        this._preprocessData();
        
        // Setup time constants
        this.setup_time_constants();

        // Auto-solve if requested
        if (options.solve !== false) {
            this.solve();
        }
    }

    /**
     * Parse impedance input into consistent format
     * @private
     */
    _parseImpedance(impedance) {
        if (Array.isArray(impedance) && impedance[0]?.re !== undefined) {
            // Array of {re, im} objects
            return {
                re: impedance.map(z => z.re),
                im: impedance.map(z => z.im)
            };
        }
        // Already in {re: [], im: []} format
        return { re: [...impedance.re], im: [...impedance.im] };
    }

    /**
     * Preprocess data - remove ohmic offset and inductive components
     * @private
     */
    _preprocessData() {
        // Find high-frequency ohmic offset (R_offset)
        const highFreqIdx = this._frequency_Hz.reduce((maxIdx, f, i, arr) => 
            f > arr[maxIdx] ? i : maxIdx, 0);
        this._R_offset_Ohm = this._impedance_Ohm.re[highFreqIdx];

        // Store processed data (subtract R_offset)
        this._z_data_re = this._impedance_Ohm.re.map(z => z - this._R_offset_Ohm);
        this._z_data_im = this._impedance_Ohm.im;
    }

    /**
     * Setup logarithmically-spaced time constant array
     * @param {object} options
     * @returns {DRT} this (for chaining)
     */
    setup_time_constants(options = {}) {
        const tau_min = options.tau_range_min_s ?? this._tau_range_min_s;
        const tau_max = options.tau_range_max_s ?? this._tau_range_max_s;
        const ppd = options.tau_points_per_decade ?? this._tau_points_per_decade;

        const decades = Math.log10(tau_max) - Math.log10(tau_min);
        const numPoints = Math.ceil(decades * ppd) + 1;

        this._tau_s = [];
        this._ln_tau_tau0 = [];

        for (let i = 0; i < numPoints; i++) {
            const logTau = Math.log10(tau_min) + (i / ppd);
            const tau = Math.pow(10, logTau);
            this._tau_s.push(tau);
            this._ln_tau_tau0.push(Math.log(tau));
        }

        return this;
    }

    /**
     * Solve the DRT using NNLS
     * @param {object} options - Override options for this solve
     * @returns {DRT} this (for chaining)
     */
    solve(options = {}) {
        const solving_data = options.solving_data ?? this._solving_data;
        const epsilon = options.epsilon ?? this._epsilon;
        const tau_lower = options.tau_lower_boundary_s ?? this._tau_min_s;
        const tau_upper = options.tau_upper_boundary_s ?? this._tau_max_s;

        // Build kernel matrix K
        const K_rc = this._get_rc_kernel_matrix();
        
        // Get basis matrix B (to be overridden in subclasses)
        const B = this._get_basis_matrix();
        
        // Combined kernel: A = K_rc * B
        const A_full = K_rc.mmul(B);

        // Build system based on solving_data
        let A, b;
        const nFreq = this._frequency_Hz.length;
        
        if (solving_data === DRT.COMBINED) {
            // Stack real and imaginary parts
            A = Matrix.zeros(2 * nFreq, A_full.columns);
            b = [];
            
            for (let i = 0; i < nFreq; i++) {
                for (let j = 0; j < A_full.columns; j++) {
                    A.set(i, j, A_full.get(i, j));           // Real part
                    A.set(i + nFreq, j, A_full.get(i + nFreq, j)); // Imag part
                }
                b.push(this._z_data_re[i]);
            }
            for (let i = 0; i < nFreq; i++) {
                b.push(this._z_data_im[i]);
            }
        } else if (solving_data === DRT.REAL) {
            A = extractColumns(A_full, Array.from({length: A_full.columns}, (_, i) => i));
            A = Matrix.zeros(nFreq, A_full.columns);
            for (let i = 0; i < nFreq; i++) {
                for (let j = 0; j < A_full.columns; j++) {
                    A.set(i, j, A_full.get(i, j));
                }
            }
            b = [...this._z_data_re];
        } else { // IMAG
            A = Matrix.zeros(nFreq, A_full.columns);
            for (let i = 0; i < nFreq; i++) {
                for (let j = 0; j < A_full.columns; j++) {
                    A.set(i, j, A_full.get(i + nFreq, j));
                }
            }
            b = [...this._z_data_im];
        }

        // Apply Tikhonov regularization if epsilon is set
        if (epsilon !== false && epsilon > 0) {
            const L = this._get_regularization_matrix();
            const nRows = A.rows;
            const nCols = A.columns;
            
            // Augment A with epsilon * L
            const A_reg = Matrix.zeros(nRows + L.rows, nCols);
            for (let i = 0; i < nRows; i++) {
                for (let j = 0; j < nCols; j++) {
                    A_reg.set(i, j, A.get(i, j));
                }
            }
            for (let i = 0; i < L.rows; i++) {
                for (let j = 0; j < L.columns; j++) {
                    A_reg.set(nRows + i, j, epsilon * L.get(i, j));
                }
            }
            
            // Augment b with zeros
            const b_reg = [...b, ...new Array(L.rows).fill(0)];
            
            A = A_reg;
            b = b_reg;
        }

        // Solve using NNLS
        const result = nnls(A, b);
        
        // Store raw weight vector (before basis transformation)
        this._weight_hat_Ohm = result.x;
        
        // Apply basis to get gamma_hat
        // weight_vector = B * weight_hat
        const B_arr = B.to2DArray();
        this._weight_vector = new Array(this._tau_s.length).fill(0);
        for (let i = 0; i < this._tau_s.length; i++) {
            for (let j = 0; j < this._weight_hat_Ohm.length; j++) {
                this._weight_vector[i] += B_arr[i][j] * this._weight_hat_Ohm[j];
            }
        }

        // Refine weight vector (remove artifacts at boundaries)
        this._refine_weight_vector(tau_lower, tau_upper);

        // Compute back-calculated impedance
        this._compute_z_back();
        
        // Store residual norm
        this._resnorm_Ohm = result.residualNorm;

        return this;
    }

    /**
     * Build RC kernel matrix for impedance
     * @private
     * @returns {Matrix} Kernel matrix (2*nFreq x nTau)
     */
    _get_rc_kernel_matrix() {
        const nFreq = this._frequency_Hz.length;
        const nTau = this._tau_s.length;
        
        // Stack [K_real; K_imag]
        const K = Matrix.zeros(2 * nFreq, nTau);
        
        for (let i = 0; i < nFreq; i++) {
            const omega = 2 * Math.PI * this._frequency_Hz[i];
            
            for (let j = 0; j < nTau; j++) {
                const tau = this._tau_s[j];
                const denom = 1 + Math.pow(omega * tau, 2);
                
                // Real part: 1 / (1 + (omega*tau)^2)
                K.set(i, j, 1 / denom);
                
                // Imaginary part: -omega*tau / (1 + (omega*tau)^2)
                K.set(i + nFreq, j, -omega * tau / denom);
            }
        }
        
        return K;
    }

    /**
     * Get basis matrix (identity for base class - override in subclasses)
     * @protected
     * @returns {Matrix} Basis matrix (nTau x nTau)
     */
    _get_basis_matrix() {
        throw new Error('_get_basis_matrix() must be implemented by subclass');
    }

    /**
     * Get regularization matrix (identity matrix for Tikhonov)
     * @protected
     * @returns {Matrix} Regularization matrix
     */
    _get_regularization_matrix() {
        return Matrix.eye(this._tau_s.length);
    }

    /**
     * Refine weight vector - remove boundary artifacts
     * @private
     */
    _refine_weight_vector(tau_lower, tau_upper) {
        // 1. Boundary trimming
        if (tau_lower !== null) {
            for (let i = 0; i < this._tau_s.length; i++) {
                if (this._tau_s[i] < tau_lower) {
                    this._weight_vector[i] = 0;
                }
            }
        }
        if (tau_upper !== null) {
            for (let i = 0; i < this._tau_s.length; i++) {
                if (this._tau_s[i] > tau_upper) {
                    this._weight_vector[i] = 0;
                }
            }
        }

        // 2. Noise removal - set small values (<0.1% of max) to zero
        const maxWeight = Math.max(...this._weight_vector);
        const noiseThreshold = 0.001 * maxWeight;
        for (let i = 0; i < this._weight_vector.length; i++) {
            if (this._weight_vector[i] < noiseThreshold) {
                this._weight_vector[i] = 0;
            }
        }

        // 3. Peak merging - consolidate neighboring nonzero values
        // Only for non-identity basis (Cole-Cole, Gauss, etc.)
        this._merge_peaks();
    }

    /**
     * Merge neighboring nonzero weights into discrete peaks
     * @private
     */
    _merge_peaks() {
        const w = this._weight_vector;
        const n = w.length;
        
        // Find contiguous nonzero regions
        let i = 0;
        while (i < n) {
            // Skip zeros
            if (w[i] === 0) {
                i++;
                continue;
            }
            
            // Found start of a peak region
            let peakStart = i;
            let peakEnd = i;
            let totalWeight = 0;
            let weightedTauSum = 0;
            
            // Find extent of this peak (contiguous nonzero values)
            while (peakEnd < n && w[peakEnd] > 0) {
                totalWeight += w[peakEnd];
                weightedTauSum += w[peakEnd] * this._ln_tau_tau0[peakEnd];
                peakEnd++;
            }
            
            // If peak spans multiple points, consolidate
            if (peakEnd - peakStart > 1) {
                // Find tau closest to weighted center
                const centerLnTau = weightedTauSum / totalWeight;
                let centerIdx = peakStart;
                let minDist = Infinity;
                
                for (let j = peakStart; j < peakEnd; j++) {
                    const dist = Math.abs(this._ln_tau_tau0[j] - centerLnTau);
                    if (dist < minDist) {
                        minDist = dist;
                        centerIdx = j;
                    }
                }
                
                // Zero out all but center, put total weight there
                for (let j = peakStart; j < peakEnd; j++) {
                    w[j] = (j === centerIdx) ? totalWeight : 0;
                }
            }
            
            i = peakEnd;
        }
    }

    /**
     * Compute back-calculated impedance from DRT
     * @private
     */
    _compute_z_back() {
        const nFreq = this._frequency_Hz.length;
        const nTau = this._tau_s.length;
        
        this._z_back_Ohm = { re: [], im: [] };
        
        for (let i = 0; i < nFreq; i++) {
            const omega = 2 * Math.PI * this._frequency_Hz[i];
            let zRe = this._R_offset_Ohm;
            let zIm = 0;
            
            for (let j = 0; j < nTau; j++) {
                const tau = this._tau_s[j];
                const R = this._weight_vector[j];
                const denom = 1 + Math.pow(omega * tau, 2);
                
                zRe += R / denom;
                zIm += -omega * tau * R / denom;
            }
            
            this._z_back_Ohm.re.push(zRe);
            this._z_back_Ohm.im.push(zIm);
        }
    }

    /**
     * Calculate capacitance from tau and R
     * @protected
     */
    _get_capacitance(tau_s, R_Ohm) {
        return tau_s / R_Ohm;
    }

    /**
     * Extract separated peaks from DRT
     * @param {object} options
     * @returns {DRTPeak[]} List of DRTPeak objects
     */
    get_separated_peak_list(options = {}) {
        const maxPeaks = options.max_peak_number ?? null;
        const tau_min = options.tau_min_s ?? 1e-12;
        const tau_max = options.tau_max_s ?? 1e12;
        const sortByTau = options.sort_by_tau ?? true;
        
        // Find local maxima in gamma
        const peaks = [];
        const gamma = this.gamma;
        
        for (let i = 1; i < gamma.length - 1; i++) {
            const tau = this._tau_s[i];
            if (tau < tau_min || tau > tau_max) continue;
            
            if (gamma[i] > gamma[i-1] && gamma[i] > gamma[i+1] && gamma[i] > 0) {
                // Found a peak - extract its contribution
                const peakGamma = this._extract_peak_contribution(i);
                const R_Ohm = this._integrate_peak(peakGamma);
                const C_F = this._get_capacitance(tau, R_Ohm);
                
                peaks.push(new DRTPeak({
                    tau_s: tau,
                    R_Ohm: R_Ohm,
                    C_F: C_F,
                    weight: this._weight_vector[i],
                    gamma_hat_Ohm: peakGamma,
                    R_offset_Ohm: this._R_offset_Ohm
                }));
            }
        }
        
        // Sort by tau if requested
        if (sortByTau) {
            peaks.sort((a, b) => a.tau_s - b.tau_s);
        }
        
        // Limit number of peaks
        if (maxPeaks !== null && peaks.length > maxPeaks) {
            return peaks.slice(0, maxPeaks);
        }
        
        return peaks;
    }

    /**
     * Extract single peak contribution (simplified)
     * @private
     */
    _extract_peak_contribution(peakIdx) {
        // Simplified: return the gamma_hat values around the peak
        return [...this._weight_vector];
    }

    /**
     * Integrate peak to get total resistance
     * @private
     */
    _integrate_peak(peakGamma) {
        // Simple trapezoidal integration over ln(tau)
        let R = 0;
        for (let i = 0; i < peakGamma.length - 1; i++) {
            const dLnTau = this._ln_tau_tau0[i+1] - this._ln_tau_tau0[i];
            R += 0.5 * (peakGamma[i] + peakGamma[i+1]) * dLnTau;
        }
        return R;
    }

    // ========== STATIC METHODS ==========

    /**
     * Optimize regularization parameter using binary search
     * @static
     * @param {DRT} drt - DRT instance
     * @param {object} options
     * @returns {DRT} Optimized DRT instance
     */
    static optimize_regularization_parameters(drt, options = {}) {
        const eps_min = options.epsilon_min ?? 1e-8;
        const eps_max = options.epsilon_max ?? 1e3;
        const threshold = options.relative_residual_threshold ?? 0.01;
        const tol = options.tol ?? 1e-6;
        
        let lo = Math.log10(eps_min);
        let hi = Math.log10(eps_max);
        
        // Binary search for optimal epsilon
        while (hi - lo > tol) {
            const mid = (lo + hi) / 2;
            const eps = Math.pow(10, mid);
            
            drt.solve({ epsilon: eps });
            
            if (drt.relative_resnorm > threshold) {
                hi = mid;  // Reduce regularization
            } else {
                lo = mid;  // Increase regularization
            }
        }
        
        // Final solve with optimal epsilon
        drt._epsilon = Math.pow(10, (lo + hi) / 2);
        drt.solve();
        
        return drt;
    }

    // ========== PROPERTIES (Getters) ==========

    /** Time constants array */
    get tau_s() { return this._tau_s ? [...this._tau_s] : null; }
    
    /** Natural log of tau */
    get ln_tau_tau0() { return this._ln_tau_tau0 ? [...this._ln_tau_tau0] : null; }
    
    /** Weight vector (R values) */
    get weight_vector() { return this._weight_vector ? [...this._weight_vector] : null; }
    
    /** Weight hat (before basis transformation) */
    get weight_hat_Ohm() { return this._weight_hat_Ohm ? [...this._weight_hat_Ohm] : null; }
    
    /** Gamma = weight_vector (for compatibility) */
    get gamma() { return this.weight_vector; }
    
    /** Gamma hat = weight_vector (for compatibility) */
    get gamma_hat_Ohm() { return this.weight_vector; }
    
    /** Ohmic offset resistance */
    get R_offset_Ohm() { return this._R_offset_Ohm; }
    
    /** Total polarization resistance */
    get R_pol_Ohm() {
        if (!this._weight_vector) return null;
        return this._weight_vector.reduce((sum, w) => sum + w, 0);
    }
    
    /** Input impedance data */
    get z_data_Ohm() {
        return {
            re: this._impedance_Ohm.re,
            im: this._impedance_Ohm.im
        };
    }
    
    /** Back-calculated impedance */
    get z_back_Ohm() { return this._z_back_Ohm; }
    
    /** Residual norm */
    get resnorm_Ohm() { return this._resnorm_Ohm; }
    
    /** Relative residual norm */
    get relative_resnorm() {
        if (!this._resnorm_Ohm || !this._impedance_Ohm) return null;
        const norm = Math.sqrt(
            this._impedance_Ohm.re.reduce((s, r) => s + r*r, 0) +
            this._impedance_Ohm.im.reduce((s, i) => s + i*i, 0)
        );
        return this._resnorm_Ohm / norm;
    }
    
    /** R-squared goodness of fit */
    get r_squared() {
        if (!this._z_back_Ohm) return null;
        
        const y = [...this._z_data_re, ...this._z_data_im];
        const yHat = [...this._z_back_Ohm.re.map(r => r - this._R_offset_Ohm), ...this._z_back_Ohm.im];
        const yMean = y.reduce((s, v) => s + v, 0) / y.length;
        
        const ssTot = y.reduce((s, v) => s + Math.pow(v - yMean, 2), 0);
        const ssRes = y.reduce((s, v, i) => s + Math.pow(v - yHat[i], 2), 0);
        
        return 1 - ssRes / ssTot;
    }
    
    /** RMSE in Ohms */
    get rmse_Ohm() {
        if (!this._z_back_Ohm) return null;
        const n = this._frequency_Hz.length * 2;
        return this._resnorm_Ohm / Math.sqrt(n);
    }
    
    /** Frequency array */
    get frequency_Hz() { return [...this._frequency_Hz]; }
    
    /** Epsilon (regularization parameter) */
    get epsilon() { return this._epsilon; }
}

/**
 * Cole-Cole DRT - Uses Cole-Cole distribution functions
 * Shape controlled by alpha (fractal exponent, 0 < alpha <= 1)
 * For depressed ZARC elements
 */
class ColeColeDRT extends DRT {
    static DEFAULT_ALPHA = 0.95;

    constructor(frequency_Hz, impedance_Ohm, options = {}) {
        super(frequency_Hz, impedance_Ohm, { ...options, solve: false });
        this._alpha = options.alpha ?? ColeColeDRT.DEFAULT_ALPHA;
        
        if (options.solve !== false) {
            this.solve();
        }
    }

    /** Alpha shape parameter */
    get alpha() { return this._alpha; }
    set alpha(value) { this._alpha = value; }

    /**
     * @override
     * Cole-Cole basis matrix (Boukamp & Rolle 2018)
     */
    _get_basis_matrix(alpha = null) {
        const a = alpha ?? this._alpha;
        const nTau = this._tau_s.length;
        
        const B = Matrix.zeros(nTau, nTau);
        
        for (let i = 0; i < nTau; i++) {
            for (let j = 0; j < nTau; j++) {
                // tau_c = tau_i / tau_j
                const lnDiff = this._ln_tau_tau0[i] - this._ln_tau_tau0[j];
                
                // Cole-Cole distribution function
                const numerator = Math.sin(Math.PI * a);
                const denominator = Math.cosh(a * lnDiff) + Math.cos(Math.PI * a);
                const basis = (1 / (2 * Math.PI)) * numerator / denominator;
                
                B.set(i, j, basis);
            }
        }
        
        return B;
    }

    /**
     * @override
     * Capacitance for Cole-Cole: Q = tau^alpha / R
     */
    _get_capacitance(tau_s, R_Ohm) {
        return Math.pow(tau_s, this._alpha) / R_Ohm;
    }

    /**
     * Analytical solution for Cole-Cole distribution
     * @static
     */
    static get_analytical_solution(tau_s, tau_c, alpha) {
        const lnRatio = Math.log(tau_s / tau_c);
        const numerator = Math.sin(Math.PI * alpha);
        const denominator = Math.cosh(alpha * lnRatio) + Math.cos(Math.PI * alpha);
        return (1 / (2 * Math.PI)) * numerator / denominator;
    }

    /**
     * Optimize alpha shape parameter
     * @static
     */
    static optimize_shape_parameters(drt, options = {}) {
        const alpha_min = options.alpha_min ?? 0.5;
        const alpha_max = options.alpha_max ?? 1.0;
        const steps = options.steps ?? 20;
        
        let bestAlpha = drt._alpha;
        let bestCost = Infinity;
        
        for (let i = 0; i <= steps; i++) {
            const alpha = alpha_min + (alpha_max - alpha_min) * (i / steps);
            drt._alpha = alpha;
            drt.solve();
            
            const cost = drt.relative_resnorm + 0.01 * drt._count_nonzero_weights();
            
            if (cost < bestCost) {
                bestCost = cost;
                bestAlpha = alpha;
            }
        }
        
        drt._alpha = bestAlpha;
        drt.solve();
        
        return drt;
    }

    _count_nonzero_weights() {
        return this._weight_vector.filter(w => w > 1e-10).length;
    }
}

/**
 * Data container for individual DRT peaks
 */
class DRTPeak {
    /**
     * @param {object} params
     * @param {number} params.tau_s - Relaxation time in seconds
     * @param {number} params.R_Ohm - Resistance in Ohms
     * @param {number} params.C_F - Capacitance in Farads
     * @param {number} params.weight - Peak weight
     * @param {number[]} params.gamma_hat_Ohm - Gamma values
     * @param {number} params.R_offset_Ohm - Offset resistance
     */
    constructor({ tau_s, R_Ohm, C_F, weight, gamma_hat_Ohm, R_offset_Ohm }) {
        this._tau_s = tau_s;
        this._R_Ohm = R_Ohm;
        this._C_F = C_F;
        this._weight = weight;
        this._gamma_hat_Ohm = gamma_hat_Ohm;
        this._R_offset_Ohm = R_offset_Ohm;
    }

    get tau_s() { return this._tau_s; }
    get R_Ohm() { return this._R_Ohm; }
    get C_F() { return this._C_F; }
    get weight() { return this._weight; }
    get gamma_hat_Ohm() { return [...this._gamma_hat_Ohm]; }
    get R_offset_Ohm() { return this._R_offset_Ohm; }
    
    /** Normalized gamma = gamma_hat / R */
    get gamma() {
        return this._gamma_hat_Ohm.map(g => g / this._R_Ohm);
    }
}
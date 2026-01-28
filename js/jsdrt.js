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
        this.alpha = options.alpha ?? 0.92;
        this.epsilon = options.epsilon ?? false; // Niemand hat die Absicht, zu regularisieren

        // Tau range, for which the DRT is computed
        this.tau_range_min_s = options.tau_range_min_s ?? 1e-6;
        this.tau_range_max_s = options.tau_range_max_s ?? 1e6;
        this.tau_range_points_per_decade = options.tau_range_points_per_decade ?? 30; // The more, the slower the computation but the smoother the DRT
        
        // Tau range, in which signals are considered (outside that, the peaks will be omitted)
        // (should consequently be narrower than the tau range above)
        this.tau_min_s = options.tau_min_s ?? 1e-6;
        this.tau_max_s = options.tau_max_s ?? 1e6;
    }

}
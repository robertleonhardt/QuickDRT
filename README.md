# QuickDRT
QuickDRT is a lightweight, easy-to-use app for computing distribution of relaxation times (DRT) functions from measured impedance spectra.
It's JavaScript only, so it runs in the browser without the need for any installation or Python backend - just double-click the index.html file.
Based on PyDRT (https://github.com/robertleonhardt/PyDRT), it uses basis functions for clean process separation and thus enhanced impedance analysis.

The underlying Python code is published as part of the following work:
> Leonhardt, et al. (2025). "Reconstructing the distribution of relaxation times with analytical basis functions" Journal of Power Sources 652, DOI: 10.1016/j.jpowsour.2025.237403

URL: https://doi.org/10.1016/j.jpowsour.2025.237403

## Usage
Download the package, find the index.html, and double-click it.
You can then open your Gamry files (or a simple CSV file) and start computing DRTs dynamically.

## More information
If you need more information, the following resources should provide a good start:
* Documentation on the underlying DRT algorithm: https://github.com/robertleonhardt/PyDRT
* Publication on the use of analytical basis functions for DRT reconstruction: https://doi.org/10.1016/j.jpowsour.2025.237403

## Sources and acknowledgements
> Wan, T. H., et al. (2015). "Influence of the Discretization Methods on the Distribution of Relaxation Times Deconvolution: Implementing Radial Basis Functions with DRTtools." Electrochimica Acta 184: 483-499.

and, as the main source for the implementation of the Cole-Cole and Havriliak-Negami bases, 
> T. Tichter. https://github.com/Polarographica/Polarographica_program

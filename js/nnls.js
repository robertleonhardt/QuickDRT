/**
 * Non-negative least squares solver (NNLS)
 * Lawson-Hansin algorithm implementation for js
 * 
 * Solves: min||Ax-b||² with x >= 0 in all components
 * 
 * @param {Matrix} A - Coefficient matrix (m x n)
 * @param {number[]} b - Right-hand side vector (length m)
 * @pram {object} options - Settings
 * @returns {object} { x: solution vector, residualNorm: ||Ax-b|| }
 */
function nnls(A, b, options = {}) {
    const maxIter = options.maxIter ?? 3 * A.columns;
    const tolerance = options.tolerance ?? 1e-10;

    const m = A.rows;
    const n = A.columns;

    const At = A.transpose();
    const Atb = At.mmul(Matrix.columnVector(b)).to1DArray();
}
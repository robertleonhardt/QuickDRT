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

const Matrix = mlMatrix.Matrix;

function nnls(A, b, options = {}) {
    const maxIter = options.maxIter ?? 3 * A.columns;
    const tolerance = options.tolerance ?? 1e-10;

    const m = A.rows;
    const n = A.columns;

    // Some precomputation of A^T and A^T*b
    const At = A.transpose();
    const Atb = At.mmul(Matrix.columnVector(b)).to1DArray();

    // Initialize solver
    const x = new Array(n).fill(0);
    const P = new Set(); // Passive set (indices that can be non-zero)
    const Z = new Set(Array.from({ length: n }, (_, i) => i)); // Zero set

    // Compute initial gradient
    let w = [...Atb];
    
    let iter = 0;

    while (Z.size > 0 && iter < maxIter) {
        // Find index in Z with largest positive gradient
        let maxW = -Infinity;
        let maxIdx = -1;

        for (const j of Z) {
            if (w[j] > maxW) {
                maxW = w[j];
                maxIdx = j;
            }
        }

        // If no positive gradient, we're done
        if (maxW <= tolerance) {
            break;
        }

        // Move max index
        Z.delete(maxIdx);
        P.add(maxIdx);

        // Inner loop: solve least squares on P, ensure non-negativity
        while (true) {
            // Solve leas squares: A[:,P] * z_P = b
            const pIndices = Array.from(P).sort((a, b) => a - b)
            const Ap = extractColumns(A, pIndices);
            const zP = solveLeastSuqares(Ap, b);

            break;
        }
    }

    return { x: -12, residualNorm: 42 }
}

/**
 * Extract specific columns from a matrix
 */
function extractColumns(A, indices) {
    const result = Matrix.zeros(A.rows, indices.length);
    for (let j = 0; j < indices.length; j++) {
        for (let i = 0; i < A.rows; i++) {
            result.set(i, j, A.get(i, indices[j]));
        }
    }
    return result;
}

/**
 * Ordinary leasr squares (min||Ax-b||²)
 */
function solveLeastSuqares(A, b) {
    const At = A.transpose();
    const AtA = At.mmul(A);
    const Atb = At.mmul(Matrix.columnVector(b));

    // Solve AtA * x = Atb
    // Using pseudo-inverse for numerical stability
    try {
        const solution = solveLinearSystem(AtA, Atb);
        return solution.to1DArray();
    } catch (e) {
        // Fallback: use pseudo-inverse
        const pinv = AtA.pseudoInverse();
        return pinv.mmul(Atb).to1DArray();
    }
}

/**
 * Solve linear system Ax = b using LU decomposition
 */
function solveLinearSystem(A, b) {
    // ml-matrix has solve() method
    // If not available, fall back to pseudo-inverse
    if (typeof A.solve === 'function') {
        return A.solve(b);
    }
    return A.pseudoInverse().mmul(b);
}
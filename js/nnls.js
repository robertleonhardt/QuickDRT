/**
 * Non-negative least squares solver (NNLS)
 * Lawson-Hansin algorithm implementation for js
 * The implementation was supported by Claude Code, btw.
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
            const zP = solveLeastSquares(Ap, b);

            // Check if all z_P >= 0
            let allPositive = true;
            for (let i = 0; i < zP.length; i++) {
                if (zP[i] < tolerance) {
                    allPositive = false;
                    break;
                }
            }
            
            if (allPositive) {
                // Accept solution
                for (let i = 0; i < pIndices.length; i++) {
                    x[pIndices[i]] = zP[i];
                }
                break;
            }

            // Find alpha: how far can we move toward z while staying >= 0
            let alpha = Infinity;
            let alphaIdx = -1;

            for (let i = 0; i < pIndices.length; i++) {
                const j = pIndices[i];
                if (zP[i] <= tolerance) {
                    const ratio = x[j] / (x[j] - zP[i] + 1e-15);
                    if (ratio < alpha) {
                        alpha = ratio;
                        alphaIdx = j;
                    }
                }
            }

            // Update x: x = x + alpha*(z-x)
            for (let i = 0; i < pIndices.length; i++) {
                const j = pIndices[i];
                x[j] = x[j] + alpha * (zP[i] - x[j]);
            }

            // Move indices with x = 0 from P to Z
            for (const j of Array.from(P)) {
                if (x[j] <= tolerance) {
                    x[j] = 0;
                    P.delete(j);
                    Z.add(j);
                }
            }

            if (P.size === 0) break;
        }

        // Update gradient: w = A^T*(b-Ax)
        const Ax = A.mmul(Matrix.columnVector(x)).to1DArray();
        const residual = b.map((bi, i) => bi - Ax[i]);
        w = At.mmul(Matrix.columnVector(residual)).to1DArray();

        iter++;
    }

    // Compute final residual norm
    const Ax = A.mmul(Matrix.columnVector(x)).to1DArray();
    const residualNorm = Math.sqrt(b.reduce((sum, bi, i) => sum + Math.pow(bi -Ax[i], 2), 0));

    return { x, residualNorm }
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
function solveLeastSquares(A, b) {
    const QR = mlMatrix.QrDecomposition;
    const qr = new QR(A);
    const bVec = Matrix.columnVector(b);
    return qr.solve(bVec).to1DArray();
}
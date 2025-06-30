// A minimal library for 4x4 matrix math, essential for WebGL transformations.
export const mat4 = {
    /**
     * Creates a new identity matrix. An identity matrix is a base matrix
     * that doesn't apply any transformation (no scaling, rotation, or translation).
     * @returns {Float32Array} A new 16-element identity matrix.
     */
    create: () => {
        const out = new Float32Array(16);
        // Set the diagonal elements to 1 to create the identity matrix.
        out[0] = 1;
        out[5] = 1;
        out[10] = 1;
        out[15] = 1;
        return out;
    },

    /**
     * Generates an orthographic projection matrix. This is used to create a 2D "camera"
     * that maps the 3D world onto a 2D screen without any perspective distortion.
     */
    ortho: (out, left, right, bottom, top, near, far) => {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);
        out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
        out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
        return out;
    },

    /**
     * Translates (moves) a matrix by the given vector.
     * @param {Float32Array} out - The receiving matrix.
     * @param {Float32Array} a - The matrix to translate.
     * @param {Array<number>} v - The vector to translate by.
     */
    translate: (out, a, v) => {
        let x = v[0], y = v[1], z = v[2];
        let a00, a01, a02, a03;
        let a10, a11, a12, a13;
        let a20, a21, a22, a23;

        // The 'if' block handles the case where the output and input matrices are the same object,
        // which is a common optimization to avoid creating new matrices.
        if (a === out) {
            out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
            out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
            out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
            out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        } else {
            // This block handles translation when the output is a different matrix.
            a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
            a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
            a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

            out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
            out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
            out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

            out[12] = a00 * x + a10 * y + a20 * z + a[12];
            out[13] = a01 * x + a11 * y + a21 * z + a[13];
            out[14] = a02 * x + a12 * y + a22 * z + a[14];
            out[15] = a03 * x + a13 * y + a23 * z + a[15];
        }
        return out;
    },

    /**
     * Scales the matrix by the dimensions in the given vector.
     * @param {Float32Array} out - The receiving matrix.
     * @param {Float32Array} a - The matrix to scale.
     * @param {Array<number>} v - The vector to scale by.
     */
    scale: (out, a, v) => {
        let x = v[0], y = v[1], z = v[2];
        out[0] = a[0] * x;
        out[1] = a[1] * x;
        out[2] = a[2] * x;
        out[3] = a[3] * x;
        out[4] = a[4] * y;
        out[5] = a[5] * y;
        out[6] = a[6] * y;
        out[7] = a[7] * y;
        out[8] = a[8] * z;
        out[9] = a[9] * z;
        out[10] = a[10] * z;
        out[11] = a[11] * z;
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
        return out;
    }
};
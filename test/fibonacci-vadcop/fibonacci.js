const pot = 2 ** 2;

const mod = 5;
const in1 = 1;
const in2 = 1;

let out;

let a = new Array(pot);
let b = new Array(pot);
let x = new Array(pot);
let q = new Array(pot);
let x_mod = new Array(pot);

for (let i = 0; i < pot; i++) {
    b[i] = i === 0 ? in1 : a[i - 1];
    a[i] = i === 0 ? in2 : x[i - 1] % mod;    

    x[i] = a[i] ** 2 + b[i] ** 2;
    q[i] = Math.floor(x[i] / mod);
    x_mod[i] = x[i] % mod;
}

for (let i = 0; i < pot; i++) {
    console.log(a[i], b[i]);
}

for (let i = 0; i < pot; i++) {
    console.log(x[i], q[i], x_mod[i]);
}
# Proof Manager
This is the Proof Manager repository, an implementation of a versatile proof manager.

The Proof Manager is an adaptable Proof Manager designed to assist in the creation of proofs from an Airout-formatted files. The repository has two built-in provers (and verifiers), STARK and a FFLONK, but with the flexibility for users to implement custom provers. The proof manager supports multi-threaded proof generation (including multi-threaded execution trace generation) but is limited to a single machine.

## Usage
To generate a proof that a computation was executed correctly, you will need to do the following:

1. Define one or several AIRs of your computations using an Airout formatted file. See [PIL2 compiler](https://github.com/0xPolygonHermez/pil2-compiler) for more info.
2. Define your executors implementing a class derived from witness_calculator_component to write you execution trace/s for your computation. 
3. Define a configuration of your execution plan defining the sued executors, used libraries, prover and verifier.
4. Execute your computation and get a new proof.

License
-------

This project is [GNU v3 licensed](./LICENSE).
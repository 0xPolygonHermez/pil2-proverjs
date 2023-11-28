const ProverComponent = require("../../prover.js");
const { PROVER_OPENINGS_COMPLETED, PROVER_OPENINGS_PENDING } = require("../../provers_manager.js");
const { initProverStark,
    computeEvalsStark,
    computeFRIStark,
    genProofStark,
    extendAndMerkelize,
    getPermutationsStark,
    computeFRIFolding,
    computeFRIQueries,
    computeQStark,
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const path = require("path");

const log = require('../../../logger.js');

class StarkFriProver extends ProverComponent {
    constructor(proofCtx) {
        super("FRI Prover", proofCtx);
    }

    initialize(settings, options) {
        super.initialize(settings, options);

        this.options.logger = log;

        const starkStructFilename =  path.join(__dirname, "../../..",  settings.starkStruct);
        this.starkStruct = require(starkStructFilename);
    }

    // TODO instances has to be here or to be called from provers manager?
    async newProof(subproofId, airId, publics) {
        const airInstances = this.proofCtx.getAirInstancesBySubproofIdAirId(subproofId, airId);
        const air = this.proofCtx.airout.getAirBySubproofIdAirId(subproofId, airId);

        for (const airInstance of airInstances) {  
            log.info(`[${this.name}]`, `Initializing new proof for air '${air.name}'`);
 
            airInstance.ctx = await initProverStark(air.setup.starkInfo, air.setup.fixedPols, air.setup.constTree, this.options);
            airInstance.publics = publics;
        }
    }

    async verifyConstraints(stageId, airInstance) {
        const ctx = airInstance.ctx;

        ctx.errors = [];

        const nConstraintsStage = ctx.pilInfo.constraints[`stage${stageId}`].length;
        for(let i = 0; i < nConstraintsStage; i++) {
            const constraint = ctx.pilInfo.constraints[`stage${stageId}`][i];

            log.info(`[${this.name}]`, `··· Checking constraint ${i + 1}/${nConstraintsStage}: ${constraint.line} `);

            await callCalculateExps(`stage${stageId}`, constraint, "n", ctx, this.options.parallelExec, this.options.useThreads, true);
        }

        const isValid = ctx.errors.length === 0;
        
        if (!isValid) {
            log.error(`[${this.name}]`, `PIL constraints have not been fulfilled!`);
            for (let i = 0; i < ctx.errors.length; i++) log.error(`[${this.name}]`, ctx.errors[i]);
        }

        return isValid;
    }

    async verifyGlobalConstraints() {
        this.proofCtx.errors = [];

        if(this.proofCtx.constraintsCode !== undefined) {
            for(let i =  0; i < this.proofCtx.constraintsCode.length; i++) {
                const constraint = this.proofCtx.constraintsCode[i];
                log.info(`[${this.name}]`, `··· Checking global constraint ${i + 1}/${this.proofCtx.constraintsCode.length}: ${constraint.line} `);
                await callCalculateExps("global", constraint, "n", this.proofCtx, this.options.parallelExec, this.options.useThreads, true, true);
            }
        }


        const isValid = this.proofCtx.errors.length === 0;

        if (!isValid) {
            log.error(`[${this.name}]`, `Constraints have not been fulfilled!`);
            for (let i = 0; i < this.proofCtx.errors.length; i++) log.error(`[${this.name}]`, this.proofCtx.errors[i]);
        }

        return isValid;
    }

    async commitStage(stageId, airInstance) {
        this.checkInitialized();

        const airout = this.proofCtx.getAirout();
        const ctx = airInstance.ctx;

        if (stageId === 1) {
            airInstance.wtnsPols.writeToBigBuffer(ctx.cm1_n, ctx.pilInfo.mapSectionsN.cm1);
            await this.calculatePublics(airInstance);
        }

        if(stageId <= airout.numStages + 1) {
            const qStage = ctx.pilInfo.numChallenges.length + 1;

            if(this.options.debug) {
                ctx.errors = [];
                if(stageId === qStage) return;
            }

            const dom = stageId === qStage ? "ext" : "n";

            await callCalculateExps(`stage${stageId}`, ctx.pilInfo.code[`stage${stageId}`], dom, ctx, this.settings.parallelExec, this.settings.useThreads, false);
        
            await applyHints(stageId, ctx);

            await callCalculateExps(`stage${stageId}`, ctx.pilInfo.code[`stage${stageId}`], dom, ctx, this.settings.parallelExec, this.settings.useThreads, false);

            if(this.options.debug && stageId !== qStage) {
                const nConstraintsStage = ctx.pilInfo.constraints[`stage${stageId}`].length;

                for(let i = 0; i < nConstraintsStage; i++) {
                    const constraint = ctx.pilInfo.constraints[`stage${stageId}`][i];                    
                    log.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);
                    await callCalculateExps(`stage${stageId}`, constraint, dom, ctx, this.settings.parallelExec, this.settings.useThreads, true);
                }
            }
        }

        if(!this.options.debug) {
            let commits = stageId === airout.numStages + 1 ? await computeQStark(ctx, log) : await extendAndMerkelize(stageId, ctx, log);
            ctx.challengeValue = commits;
        } else {
            ctx.challengeValue = ctx.F.randomValue();
        }
    }

    async calculatePublics(airInstance) {
        const ctx = airInstance.ctx;
        await calculatePublics(ctx, airInstance.publics);
    }

    async openingStage(openingId, airInstance) {
        this.checkInitialized();

        const isLastRound = openingId === 2 + this.proofCtx.stepsFRI.length + 1;
        const numStages = this.proofCtx.getAirout().numStages + 1;

        if(openingId === 1) {
            await this.computeOpenings(airInstance);
        } else if(openingId === 2) {
            await this.computeFRIStark(airInstance);
        } else if(openingId <= 2 + this.proofCtx.stepsFRI.length) {
            const globalStepFRI = this.proofCtx.stepsFRI[openingId - 3].nBits;
            const step = airInstance.ctx.pilInfo.starkStruct.steps.findIndex(s => s.nBits === globalStepFRI);
            if(step === -1) {
                airInstance.ctx.challengeValue = [ [0n, 0n, 0n, 0n ]];
            } else {
                await this.computeFRIFolding(numStages + openingId, airInstance, { step });
            }
        } else if(openingId === 2 + this.proofCtx.stepsFRI.length + 1) {
            await this.computeFRIQueries(numStages + openingId, airInstance);
        } else {
            log.error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
            throw new Error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
        }

        return isLastRound ? PROVER_OPENINGS_COMPLETED : PROVER_OPENINGS_PENDING;
    }

    async computeOpenings(airInstance) {
        const ctx = airInstance.ctx;

        const subproof = this.proofCtx.airout.subproofs[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `··· Computing Openings for subproof ${subproof.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const evalCommits = await computeEvalsStark(ctx, this.options);
        
        ctx.challengeValue = evalCommits;
    }

    async computeFRIStark(airInstance) {
        const ctx = airInstance.ctx;

        const subproof = this.proofCtx.airout.subproofs[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `··· Computing FRI Stark for subproof ${subproof.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        await computeFRIStark(ctx, this.options);

        ctx.challengeValue = [];
    }

    async computeFRIFolding(stageId, airInstance, params) {
        const challenge = this.proofCtx.getChallenge(stageId - 1)[0];
        const ctx = airInstance.ctx;

        const subproof = this.proofCtx.airout.subproofs[airInstance.subproofId];
        const info = params.step === airInstance.ctx.pilInfo.starkStruct.steps.length - 1 
            ? `for last step ${airInstance.ctx.pilInfo.starkStruct.steps[params.step].nBits}`
            : `from ${airInstance.ctx.pilInfo.starkStruct.steps[params.step].nBits} to ${airInstance.ctx.pilInfo.starkStruct.steps[params.step + 1].nBits}`
        log.info(
            `[${this.name}]`,
            `··· Computing FRI Folding ${info} for subproof ${subproof.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const friCommits = await computeFRIFolding(params.step, ctx, challenge, this.options);

        ctx.challengeValue = friCommits;
    }

    async computeFRIQueries(stageId, airInstance) {
        const ctx = airInstance.ctx;

        const challenge = this.proofCtx.getChallenge(stageId - 1)[0];

        const friQueries = await getPermutationsStark(ctx, challenge);

        log.info(`[${this.name}]`, `··· FRI queries: [${friQueries.join(",")}]`);

        computeFRIQueries(ctx, friQueries);

        this.proofCtx.airInstances[airInstance.instanceId].proof = await genProofStark(ctx, this.options);
    }    

}

module.exports = StarkFriProver;

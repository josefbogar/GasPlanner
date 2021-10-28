import { BuhlmannAlgorithm, Options } from './BuhlmannAlgorithm';
import { DepthConverter } from './depth-converter';
import { Diver } from './Diver';
import { Gas, Gases } from './Gases';
import { CalculatedProfile } from './Profile';
import { Segment, Segments, SegmentsFactory } from './Segments';
import { Tank } from './Tanks';
import { Time } from './Time';


class ConsumptionSegment {
    /** in seconds */
    public startTime = 0;
    /** in seconds */
    public endTime = 0;
    /** in meters */
    private _startDepth = 0;
    /** in meters */
    private _endDepth = 0;

    /**
     * @param duration in seconds
     * @param newDepth in meters
     * @param previousDepth in meters
     */
    constructor(public duration: number, newDepth: number, previousDepth: number = 0) {
        this.endTime = Math.round(duration * 100) / 100;
        this._endDepth = newDepth;
        this._startDepth = previousDepth;
    }

    public static fromSegment(segment: Segment): ConsumptionSegment {
        return new ConsumptionSegment(segment.duration, segment.endDepth, segment.startDepth);
    }

    /** in meters */
    public get startDepth(): number {
        return this._startDepth;
    }

    /** in meters */
    public get endDepth(): number {
        return this._endDepth;
    }

    /** in meters */
    public get averageDepth(): number {
        return (this.startDepth + this.endDepth) / 2;
    }
}

/**
 * Calculates tank consumptions during the dive and related variables
 * (e.g. rock bottom, turn pressure, turn time)
 */
export class Consumption {
    /** Minimum bars to keep in tank, even for shallow dives */
    public static readonly minimumRockBottom = 30;
    /** we know the profile uses one depth level => 2 user segments */
    private static readonly userNoDecoSegments = 2;

    constructor(private depthConverter: DepthConverter) { }

    /**
     * Checks, if all tanks have more remaining gas than their reserve.
     * See also Tank.hasReserve
     */
    public static haveReserve(tanks: Tank[]): boolean {
        for (let index = 0; index < tanks.length; index++) {
            if(!tanks[index].hasReserve) {
                return false;
            }
        }

        return true;
    }

    private static calculateDecompression(segments: Segments, tanks: Tank[], options: Options): CalculatedProfile {
        const bGases = new Gases();
        const firstTank = tanks[0];
        const bGas = firstTank.gas;
        bGases.addBottomGas(bGas);

        // everything except first gas is considered as deco gas
        tanks.slice(1, tanks.length).forEach((gas) => {
            const decoGas = gas.gas;
            bGases.addDecoGas(decoGas);
        });

        const algorithm = new BuhlmannAlgorithm();
        const profile = algorithm.calculateDecompression(options, bGases, segments);
        return profile;
    }

    /**
     * Updates tanks consumption based on segments
     * @param segments Profile generated by algorithm including user defined + generated ascent,
     *                 the array needs have at least 3 items (descent, swim, ascent).
     * @param userSegments The number of segments from the profile defined by user, the rest is counted as calculated ascent.
     * @param tanks: All tanks used to generate the profile, their gases need to fit all used in segments param
     * @param sac diver surface air consumption in Liters/minute.
     */
    public consumeFromTanks(segments: Segment[], userSegments: number, tanks: Tank[], diver: Diver): void {
        if (segments.length < 3) {
            throw new Error('Profile needs to contain at least three segments.');
        }

        Tank.resetConsumption(tanks);
        const remainToConsume = this.consumeByTanks(segments, diver.sac);
        this.consumeByGases(segments, tanks, diver.sac, remainToConsume);
        const ascent = SegmentsFactory.ascent(segments, userSegments);
        this.updateReserve(ascent, tanks, diver.stressSac);
    }

    /**
     * We cant provide this method for multilevel dives, because we don't know which segment to extend
     * @param plannedDepth Maximum depth reached during the dive
     * @param tanks The tanks used during the dive to check available gases
     * @param diver Consumption SAC definition
     * @param options ppO2 definitions needed to estimate ascent profile
     * @param noDecoTime Known no decompression time in minutes for required depth
     * @returns Number of minutes representing maximum time we can spend as bottom time.
     */
    public calculateMaxBottomTime(segments: Segments, tanks: Tank[], diver: Diver, options: Options, noDecoTime: number): number {
        Tank.resetConsumption(tanks);
        const recreDuration = this.nodecoProfileBottomTime(segments, tanks, diver, options);

        if (recreDuration > noDecoTime) {
            return this.estimateMaxDecotime(segments, tanks, options, diver, noDecoTime);
        }

        return Math.floor(recreDuration);
    }

    private nodecoProfileBottomTime(sourceSegments: Segments, tanks: Tank[], diver: Diver, options: Options): number {
        // const descentDuration = SegmentsFactory.descentDuration(plannedDepth, options);
        // const duration = Time.toMinutes(descentDuration); // to enforce swim (2.) segment to zero seconds duration.
        const profile = Consumption.calculateDecompression(sourceSegments, tanks, options);
        const segments = profile.segments;
        this.consumeFromTanks(segments, Consumption.userNoDecoSegments, tanks, diver); // updates all tanks including reserve
        const firstTank = tanks[0]; // TODO check all tanks

        if (Consumption.haveReserve(tanks)) {
            const swimSegment = segments[1]; // first descent, we extend always the second segment only.
            const bottomSegment = ConsumptionSegment.fromSegment(swimSegment);
            bottomSegment.duration = Time.oneMinute;
            // TODO this.consumeFromTanks
            // const bottomConsumption = this.consumedTankBars(bottomSegment, firstTank, diver.sac);
            // const swimDuration = remaining / bottomConsumption;
            // const recreDuration = duration + swimDuration; // TODO extend duration of last segment
            // return recreDuration;
        }

        return 0; // there is no nodeco time or we even don't have enough gas for no deco dive
    }

    /**
     * We need to repeat the calculation by increasing duration, until there is enough gas
     * because increase of duration means also change in the ascent plan.
     * This method is performance hit, since it needs to calculate the profile.
     */
    private estimateMaxDecotime(segments: Segments, tanks: Tank[], options: Options, diver: Diver, noDecoTime: number): number {
        let duration = noDecoTime;
        const testSegments = segments.copy();
        const lastSegment = segments.last();

        while (Consumption.haveReserve(tanks)) {
            duration++;
            segments.addFlat(lastSegment.endDepth, lastSegment.gas, 1);
            const profile = Consumption.calculateDecompression(testSegments, tanks, options);
            this.consumeFromTanks(profile.segments, Consumption.userNoDecoSegments, tanks, diver);
        }

        return duration - 1; // we already passed the way
    }

    private updateReserve(ascent: Segment[], tanks: Tank[], stressSac: number): void {
        const segments = ascent.slice();
        this.addSolvingSegment(segments);

        // here the consumed during emergency ascent means reserve
        // take all segments, because we expect all segments are not user defined => don't have tank assigned
        const gasesConsumed: Map<number, number> = this.toBeConsumed(segments, stressSac, (s) => true);

        // add the reserve from opposite order than consumed gas
        for (let index = 0 ; index <= tanks.length - 1; index++) {
            const tank = tanks[index];
            const gasCode = this.gasCode(tank.gas);
            let consumedLiters = gasesConsumed.get(gasCode) || 0;
            consumedLiters = this.addReserveToTank(tank, consumedLiters);
            gasesConsumed.set(gasCode, consumedLiters);
        }

        // Add minimum reserve to first tank only as back gas? This doesn't look nice for side mount.
        if(tanks[0].reserve < Consumption.minimumRockBottom) {
            tanks[0].reserve = Consumption.minimumRockBottom;
        }
    }

    private addReserveToTank(tank: Tank, consumedLiters: number): number {
        const consumedBars =  Math.ceil(consumedLiters / tank.size);
        const tankConsumedBars = (consumedBars + tank.reserve) > tank.startPressure ? tank.startPressure - tank.reserve : consumedBars;
        tank.reserve += tankConsumedBars;
        return this.extractRemaining(consumedLiters, tankConsumedBars, tank.size);
    }

    // in case of user defined gas switch without stay at depth (in ascent segment), we prolong the duration at depth
    private addSolvingSegment(ascent: Segment[]): void {
        // all segments are user defined
        if(ascent.length === 0){
            return;
        }

        const solvingDuration = 2 * Time.oneMinute;
        const ascentDepth = ascent[0].startDepth;
        const problemSolving = new Segment(ascentDepth, ascentDepth, ascent[0].gas, solvingDuration);
        ascent.unshift(problemSolving);
    }

    private consumeByGases(segments: Segment[], tanks: Tank[], sac: number, remainToConsume: Map<number, number>): void {
        // assigned tank will be consumed from that tank directly
        // it is always user defined segment (also in ascent)
        const gasesConsumed: Map<number, number> = this.toBeConsumedYet(segments, sac, remainToConsume, (s) => !s.tank);

        // distribute the consumed liters across all tanks with that gas starting from last one
        // to consumed stages first. This simulates one of the back mounted system procedures.
        for (let index = tanks.length - 1; index >= 0; index--) {
            const tank = tanks[index];
            const gasCode = this.gasCode(tank.gas);
            let consumedLiters = gasesConsumed.get(gasCode) || 0;
            consumedLiters = this.consumeFromTank(tank, consumedLiters);
            gasesConsumed.set(gasCode, consumedLiters);
        }
    }

    private consumeByTanks(segments: Segment[], sac: number): Map<number, number> {
        const remainToConsume: Map<number, number> = new Map<number, number>();
        const sacSeconds = Time.toMinutes(sac);

        segments.forEach((segment: Segment)  => {
            if(segment.tank) {
                const tank = segment.tank;
                const gasCode = this.gasCode(segment.gas);
                const consumptionSegment = ConsumptionSegment.fromSegment(segment);
                const consumedLiters = this.consumedBySegment(consumptionSegment, sacSeconds);
                const remainingLiters = this.consumeFromTank(tank, consumedLiters);
                let consumedByGas: number = remainToConsume.get(gasCode) || 0;
                consumedByGas += remainingLiters;
                remainToConsume.set(gasCode, consumedByGas);
            }
        });

        return remainToConsume;
    }

    private consumeFromTank(tank: Tank, consumedLiters: number): number {
        const consumedBars =  Math.ceil(consumedLiters / tank.size);
        const tankConsumedBars = consumedBars > tank.endPressure ? tank.endPressure : consumedBars;
        tank.consumed += tankConsumedBars;
        return this.extractRemaining(consumedLiters, tankConsumedBars, tank.size);
    }

    private extractRemaining(consumedLiters: number, tankConsumedBars: number, tankSize: number): number {
        consumedLiters = consumedLiters - (tankConsumedBars * tankSize);
        // because of previous rounding up the consumed bars
        consumedLiters = consumedLiters < 0 ? 0 : consumedLiters;
        return consumedLiters;
    }

    private toBeConsumed(segments: Segment[], sac: number, includeSegment: (segment: Segment) => boolean): Map<number, number> {
        const emptyConsumptions = new Map<number, number>();
        return this.toBeConsumedYet(segments, sac, emptyConsumptions, includeSegment);
    }

    private toBeConsumedYet(segments: Segment[], sac: number,
        remainToConsume: Map<number, number>,
        includeSegment: (segment: Segment) => boolean): Map<number, number> {

        const sacSeconds = Time.toMinutes(sac);

        for (let index = 0; index < segments.length; index++) {
            const segment = segments[index];

            if(includeSegment(segment)) {
                const gas = segment.gas;
                const gasCode = this.gasCode(gas);
                const converted = ConsumptionSegment.fromSegment(segment);
                const consumedLiters = this.consumedBySegment(converted, sacSeconds);
                let consumedByGas: number = remainToConsume.get(gasCode) || 0;
                consumedByGas += consumedLiters;
                remainToConsume.set(gasCode, consumedByGas);
            }
        }

        return remainToConsume;
    }

    private gasCode(gas: Gas): number {
        const fourK = 10000;
        // considered identical gas rounding on two decimal places
        return Math.round(gas.fO2 * fourK) * fourK + Math.round(gas.fHe * fourK);
    }

    /** returns bar consumed by segment based on tank size and sac */
    private consumedTankBars(segment: ConsumptionSegment, tank: Tank, sac: number): number {
        const sacSeconds = Time.toMinutes(sac);
        const liters = this.consumedBySegment(segment, sacSeconds);
        const bars = liters / tank.size;
        return bars;
    }

    /**
     * Returns consumption in Liters at given segment average depth
     * @param sacSeconds Liter/second
     */
    private consumedBySegment(segment: ConsumptionSegment, sacSeconds: number) {
        const averagePressure = this.depthConverter.toBar(segment.averageDepth);
        const consumed = segment.duration * averagePressure * sacSeconds;
        return consumed;
    }
}


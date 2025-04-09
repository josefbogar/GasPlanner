import { Precision } from '../common/precision';
import { BuhlmannAlgorithm } from '../algorithm/BuhlmannAlgorithm';
import { DepthConverter } from '../physics/depth-converter';
import { Diver } from './Diver';
import { Options } from '../algorithm/Options';
import { CalculatedProfile } from '../algorithm/CalculatedProfile';
import { Segment, Segments } from '../depths/Segments';
import { Tank, Tanks } from './Tanks';
import { Time } from '../physics/Time';
import { BinaryIntervalSearch, SearchContext } from '../common/BinaryIntervalSearch';
import { PlanFactory } from '../depths/PlanFactory';
import { AlgorithmParams, RestingParameters } from "../algorithm/BuhlmannAlgorithmParameters";

class GasVolumes {
    private remaining: Map<number, number> = new Map<number, number>();

    public get(gasCode: number): number {
        return this.remaining.get(gasCode) || 0;
    }

    public add(gasCode: number, toAdd: number): void {
        toAdd = toAdd > 0 ? toAdd : 0;
        const newValue = this.get(gasCode) + toAdd;
        this.remaining.set(gasCode, newValue);
    }

    public subtract(gasCode: number, tosSubtract: number): void {
        const current = this.get(gasCode);
        tosSubtract = tosSubtract > 0 ? tosSubtract : 0;
        let remaining = current - tosSubtract;
        remaining = remaining < 0 ? 0 : remaining;
        this.remaining.set(gasCode, remaining);
    }
}

class RmvContext {
    public readonly rmvPerSecond: number;
    private readonly _stressRmvPerSecond: number;
    private readonly _teamStressRmvPerSecond: number;

    constructor(private options: ConsumptionOptions, public readonly bottomTank: Tank) {
        this.rmvPerSecond = Time.toMinutes(options.diver.rmv);
        this._teamStressRmvPerSecond = Time.toMinutes(options.diver.teamStressRmv);
        this._stressRmvPerSecond = Time.toMinutes(options.diver.stressRmv);
    }

    public stressRmvPerSecond(segment: Segment): number {
        // Bottom gas = team stress rmv, deco gas = diver stress rmv,
        // TODO stage tank RMV == ?
        // User is on bottom tank, or calculated ascent using bottom gas.
        // The only issue is breathing bottom gas as travel and in such case it is user defined segment with tank assigned.
        if (segment.tank === this.bottomTank || segment.gas.compositionEquals(this.bottomTank.gas)) {
            return this._teamStressRmvPerSecond;
        }

        return this._stressRmvPerSecond;
    }

    public ensureMinimalReserve(tank: Tank, reserveVolume: number): number {
        const isBottomTank = tank === this.bottomTank;
        const minimalReserve = isBottomTank ? this.options.primaryTankReserve : this.options.stageTankReserve;
        const minimalReserveVolume = Tank.realVolume2(tank.size, minimalReserve, tank.gas);

        if(reserveVolume < minimalReserveVolume) {
            return minimalReserveVolume;
        }

        return reserveVolume;
    }
}

export interface ConsumptionOptions {
    diver: Diver;
    /** Minimum tank reserve for bottom gas tank in bars */
    primaryTankReserve: number;
    /** Minimum tank reserve for all other stage/deco tanks in bars */
    stageTankReserve: number;
}

/**
 * Calculates tank consumptions during the dive and related variables
 * (e.g. rock bottom, turn pressure, turn time)
 */
export class Consumption {
    /** Minimum bars to keep in first tank, even for shallow dives */
    public static readonly defaultPrimaryReserve = 30;
    /** Minimum bars to keep in stage tank, even for shallow dives */
    public static readonly defaultStageReserve = 20;

    constructor(private depthConverter: DepthConverter) { }

    private static calculateDecompression(segments: Segments, tanks: Tank[],
        options: Options, surfaceInterval?: RestingParameters): CalculatedProfile {
        const gases = Tanks.toGases(tanks);
        const algorithm = new BuhlmannAlgorithm();
        const segmentsCopy = segments.copy();
        const parameters = AlgorithmParams.forMultilevelDive(segmentsCopy, gases, options, surfaceInterval);
        const profile = algorithm.decompression(parameters);
        return profile;
    }

    /**
     * Updates tanks consumption based on segments, also calculates emergency profile using the decompression algorithm.
     * Emergency ascent is calculated at end of deepest point of the dive.
     * So it is time consuming => Performance hit.
     * @param segments Profile generated by algorithm including user defined + generated ascent,
     *                 the array needs have at least 3 items (descent, swim, ascent) and ends at surface.
     * @param options Not null profile behavior options.
     * @param tanks All tanks used to generate the profile, their gases need to fit all used in segments param
     * @param consumptionOptions Not null definition how to consume the gases.
     * @param surfaceInterval Optional surface interval, resting from previous dive. Null, for first dive.
     */
    public consumeFromTanks(segments: Segment[], options: Options, tanks: Tank[],
        consumptionOptions: ConsumptionOptions, surfaceInterval?: RestingParameters): void {
        if (segments.length < 2) {
            throw new Error('Profile needs to contain at least 2 segments.');
        }

        const emergencyAscent = PlanFactory.emergencyAscent(segments, options, tanks, surfaceInterval);
        this.consumeFromTanks2(segments, emergencyAscent, tanks, consumptionOptions);
    }

    /**
     * Updates tanks consumption based on segments, uses already calculated emergency ascent.
     * So it is time consuming => Performance hit.
     * @param segments Profile generated by algorithm including user defined + generated ascent,
     *                 the array needs have at least 3 items (descent, swim, ascent) and end at surface.
     * @param emergencyAscent Not null array of segments representing the special ascent.
     *                 Doesn't have to be part of the segments parameter value, since in emergency we have different ascent.
     * @param tanks All tanks used to generate the profile, their gases need to fit all used in segments param
     * @param consumptionOptions Not null consumption definition.
     */
    public consumeFromTanks2(segments: Segment[], emergencyAscent: Segment[], tanks: Tank[], consumptionOptions: ConsumptionOptions): void {
        if (segments.length < 2) {
            throw new Error('Profile needs to contain at least 2 segments.');
        }

        if (emergencyAscent.length < 1) {
            throw new Error('Emergency ascent needs to contain at least 1 segment.');
        }

        Tanks.resetConsumption(tanks);

        // Not all segments have tank assigned, but the emergency ascent is calculated
        // from last user defined segment, so there should be a tank, otherwise we have no other option.
        const bottomTank = emergencyAscent[0]?.tank ?? tanks[0];
        const rmvContext = new RmvContext(consumptionOptions, bottomTank);

        // Reserve needs to be first to be able to preserve it, when possible.
        this.updateReserve(emergencyAscent, tanks, rmvContext);
        const tankMinimum = (t: Tank) => t.reserveVolume;
        const getRmvPerSecond = (_: Segment) => rmvContext.rmvPerSecond;
        const consumedBySegmentRmv = (s: Segment, _: number) => this.consumedBySegment(s, rmvContext.rmvPerSecond);

        // First satisfy user defined segments where tank is assigned (also in ascent).
        // assigned tank will be consumed from that tank directly
        let remainToConsume: GasVolumes = this.toBeConsumedYet(segments, new GasVolumes(), getRmvPerSecond, (s) => !!s.tank);
        remainToConsume = this.consumeBySegmentTank(segments, remainToConsume, tankMinimum, consumedBySegmentRmv);
        // if more consumed, drain the tanks
        remainToConsume = this.consumeBySegmentTank(segments, remainToConsume, () => 0, (_: Segment, remaining: number) => remaining);

        // and only now we can consume the remaining gas from all other segments
        remainToConsume = this.toBeConsumedYet(segments, remainToConsume, getRmvPerSecond, (s) => !s.tank);
        remainToConsume = this.consumeByGases(tanks, remainToConsume, tankMinimum);
        // if more consumed, drain the tanks
        this.consumeByGases(tanks, remainToConsume, () => 0);
    }

    /**
     * Used to calculate how long based on available gas can diver stay at current depth of last segment.
     * We cant provide this method for multilevel dives, because we don't know which segment to extend.
     * @param sourceSegments User defined profile not ending at surface, last segment is used to prolong the bottom time.
     * @param tanks The tanks used during the dive to check available gases
     * @param consumptionOptions Not null consumption definition
     * @param options ppO2 definitions needed to estimate ascent profile
     * @param surfaceInterval Optional surface interval, resting from previous dive. Null, for first dive.
     * @returns Number of minutes representing maximum time we can spend as bottom time.
     * Returns 0 in case the duration is shorter than user defined segments.
     */
    public calculateMaxBottomTime(sourceSegments: Segments, tanks: Tank[],
        consumptionOptions: ConsumptionOptions, options: Options, surfaceInterval?: RestingParameters): number {
        const testSegments = this.createTestProfile(sourceSegments);
        const addedSegment = testSegments.last();

        const context: SearchContext = {
            // choosing the step based on typical dive duration
            estimationStep: Time.oneMinute * 40,
            initialValue: 0,
            maxValue: Time.oneDay,
            doWork: (newValue: number) => {
                addedSegment.duration = newValue;
                this.consumeFromProfile(testSegments, tanks, consumptionOptions, options, surfaceInterval);
            },
            meetsCondition: () => Tanks.haveReserve(tanks)
        };

        const interval = new BinaryIntervalSearch();
        const addedDuration = interval.search(context);

        // the estimated max. duration is shorter, than user defined segments
        if (addedDuration === 0) {
            return 0;
        }

        // Round down to minutes directly to ensure we are in range of enough value
        const totalDuration = Time.toMinutes(sourceSegments.duration + addedDuration);
        return Precision.floor(totalDuration);
    }

    private consumeFromProfile(testSegments: Segments, tanks: Tank[], consumptionOptions: ConsumptionOptions,
        options: Options, surfaceInterval?: RestingParameters) {
        const profile = Consumption.calculateDecompression(testSegments, tanks, options, surfaceInterval);
        this.consumeFromTanks(profile.segments, options, tanks, consumptionOptions, surfaceInterval);
    }

    private createTestProfile(sourceSegments: Segments): Segments {
        const testSegments = sourceSegments.copy();
        const lastUserSegment = sourceSegments.last();
        testSegments.addFlat(lastUserSegment.gas, 0);
        return testSegments;
    }

    private updateReserve(emergencyAscent: Segment[], tanks: Tank[], rmvContext: RmvContext): void {
        const getRmvPerSecond = (s: Segment) => rmvContext.stressRmvPerSecond(s);
        // here the consumed during emergency ascent means reserve
        // take all segments, because we expect all segments are not user defined => don't have tank assigned
        const gasesConsumed: GasVolumes = this.toBeConsumedYet(emergencyAscent, new GasVolumes(), getRmvPerSecond, () => true);

        // add the reserve from opposite order than consumed gas
        for (let index = 0; index <= tanks.length - 1; index++) {
            const tank = tanks[index];
            const gasCode = tank.gas.contentCode;
            const consumedLiters = gasesConsumed.get(gasCode);
            tank.reserveVolume = rmvContext.ensureMinimalReserve(tank, consumedLiters);
            gasesConsumed.subtract(gasCode, tank.reserveVolume);
        }
    }

    private consumeByGases(tanks: Tank[], remainToConsume: GasVolumes, minimumVolume: (t: Tank) => number): GasVolumes {
        // distribute the consumed liters across all tanks with that gas starting from last one
        // to consumed stages first. This simulates open circuit procedure: First consume, what you can drop.
        for (let index = tanks.length - 1; index >= 0; index--) {
            const tank = tanks[index];
            const gasCode = tank.gas.contentCode;
            let remaining = remainToConsume.get(gasCode);
            let reallyConsumed = this.consumeFromTank(tank, remaining, minimumVolume);
            remainToConsume.subtract(gasCode, reallyConsumed);
        }

        return remainToConsume;
    }

    private consumeBySegmentTank(segments: Segment[], remainToConsume: GasVolumes,
        minimumVolume: (t: Tank) => number,
        getConsumed: (s: Segment, remaining: number) => number): GasVolumes {
        segments.forEach((segment: Segment) => {
            if (segment.tank) {
                const gasCode = segment.gas.contentCode;
                let remaining: number = remainToConsume.get(gasCode);
                const consumeLiters = getConsumed(segment, remaining);
                let reallyConsumed = this.consumeFromTank(segment.tank, consumeLiters, minimumVolume);
                remainToConsume.subtract(gasCode, reallyConsumed);
            }
        });

        return remainToConsume;
    }

    /** Requires already calculated reserve */
    private consumeFromTank(tank: Tank, consumedLiters: number, minimumVolume: (t: Tank) => number): number {
        let availableLiters = tank.endVolume - minimumVolume(tank);
        availableLiters = availableLiters > 0 ? availableLiters : 0;
        const reallyConsumedLiters = consumedLiters > availableLiters ? availableLiters : consumedLiters;
        tank.consumedVolume += reallyConsumedLiters;
        return reallyConsumedLiters;
    }

    /** The only method which adds gas to GasVolumes */
    private toBeConsumedYet(
        segments: Segment[],
        remainToConsume: GasVolumes,
        getRmvPerSecond: (segment: Segment) => number,
        includeSegment: (segment: Segment) => boolean,
    ): GasVolumes {
        for (let index = 0; index < segments.length; index++) {
            const segment = segments[index];

            if (includeSegment(segment)) {
                const gas = segment.gas;
                const gasCode = gas.contentCode;
                const rmvPerSecond = getRmvPerSecond(segment);
                const consumedLiters = this.consumedBySegment(segment, rmvPerSecond);
                remainToConsume.add(gasCode, consumedLiters);
            }
        }

        return remainToConsume;
    }

    /**
     * Returns consumption in Liters at given segment average depth
     * @param rmvPerSecond Liter/second
     */
    private consumedBySegment(segment: Segment, rmvPerSecond: number): number {
        const averagePressure = this.depthConverter.toBar(segment.averageDepth);
        const duration = Precision.roundTwoDecimals(segment.duration);
        const consumed = duration * averagePressure * rmvPerSecond;
        return consumed;
    }
}

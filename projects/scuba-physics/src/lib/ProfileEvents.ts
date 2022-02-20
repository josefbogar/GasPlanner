import { Options } from './Options';
import { DepthConverter, DepthConverterFactory } from './depth-converter';
import { Ceiling, EventsFactory, Events, Event } from './Profile';
import { Segment, Segments } from './Segments';
import { Time } from './Time';
import { AscentSpeeds } from './speeds';


/** all values in bar */
class PressureSegment {
    constructor(
        public startDepth: number,
        public endDepth: number
    ) { }

    public get minDepth(): number {
        return Math.min(this.startDepth, this.endDepth);
    }

    public get maxDepth(): number {
        return Math.max(this.startDepth, this.endDepth);
    }

    public get isDescent(): boolean {
        return this.startDepth < this.endDepth;
    }

    public get isFlat(): boolean {
        return this.startDepth === this.endDepth;
    }

    public get isAscent(): boolean {
        return this.startDepth > this.endDepth;
    }
}

class EventsContext {
    public events: Events = new Events();
    public speeds: AscentSpeeds;
    public elapsed = 0;
    public index = 0;

    constructor(private userSegments: number, private profile: Segment[],
        public depthConverter: DepthConverter, public options: Options) {
        this.speeds = new AscentSpeeds(options);
        const segments = Segments.fromCollection(profile);
        this.speeds.markAverageDepth(segments);
    }

    public get previous(): Segment | null {
        if (this.index > 0) {
            return this.profile[this.index - 1];
        }

        return null;
    }

    public get isUserSegment(): boolean {
        return this.index < this.userSegments;
    }

    public get maxPpo(): number {
        if (this.isUserSegment) {
            return this.options.maxPpO2;
        }

        return this.options.maxDecoPpO2;
    }

    public get current(): Segment {
        return this.profile[this.index];
    }

    public get switchingGas(): boolean {
        return !!this.previous && !this.current.gas.compositionEquals(this.previous.gas);
    }
}

/** Creates events from profile generated by the algorithm */
export class ProfileEvents {
    /** Generates events for calculated profile
     * @param userSegments Number of segments from beginning to count as added by user
     * @param profile Complete list profile segments as user defined + calculated ascent
     * @param options User options used to create the profile
     */
    public static fromProfile(userSegments: number, profile: Segment[], ceilings: Ceiling[], options: Options): Events {
        const depthConverter = new DepthConverterFactory(options).create();
        const context = new EventsContext(userSegments, profile, depthConverter, options);
        const ceilingContext = new BrokenCeilingContext(context.events);

        for (context.index = 0; context.index < profile.length; context.index++) {
            // nice to have calculate exact time and depth of the events, it is enough it happened
            const pressureSegment = this.toPressureSegment(context.current, depthConverter);
            this.addHighPpO2(context, pressureSegment);
            this.addLowPpO2(context, pressureSegment);
            this.addGasSwitch(context);
            this.addHighDescentSpeed(context);
            this.addHighAscentSpeed(context);
            context.elapsed += context.current.duration;

            if (!ceilingContext.eventAdded) {
                ceilingContext.assignSegment(context.current);
                ProfileEvents.validateBrokenCeiling(ceilingContext, ceilings, context.current);
            }
        }

        return context.events;
    }

    private static addHighAscentSpeed(context: EventsContext) {
        const current = context.current;
        const speed = Time.toSeconds(current.speed);

        // ascent speed is negative number
        if (-speed > context.speeds.ascent(current.startDepth)) {
            const event = EventsFactory.createHighAscentSpeed(context.elapsed, current.startDepth);
            context.events.add(event);
        }
    }

    private static addHighDescentSpeed(context: EventsContext) {
        const current = context.current;
        const speed = Time.toSeconds(current.speed);

        if (speed > context.options.descentSpeed) {
            const event = EventsFactory.createHighDescentSpeed(context.elapsed, current.startDepth);
            context.events.add(event);
        }
    }

    private static addGasSwitch(context: EventsContext): void {
        if (context.switchingGas) {
            const current = context.current;
            const event = EventsFactory.createGasSwitch(context.elapsed, current.startDepth, current.gas);
            context.events.add(event);
        }
    }

    private static toPressureSegment(segment: Segment, depthConverter: DepthConverter) {
        const startPressure = depthConverter.toBar(segment.startDepth);
        const endPressure = depthConverter.toBar(segment.endDepth);
        return new PressureSegment(startPressure, endPressure);
    }

    private static addHighPpO2(context: EventsContext, segment: PressureSegment): void {
        // non user defined gas switches are never to high ppO2 - see gases.bestGas
        // otherwise we don't know which ppO2 level to use
        if (segment.isDescent || (context.isUserSegment && context.switchingGas)) {
            const gasMod = context.current.gas.mod(context.maxPpo);

            if (segment.maxDepth > gasMod) {
                const highDepth = context.depthConverter.fromBar(gasMod);
                const event = EventsFactory.createHighPpO2(context.elapsed, highDepth);
                context.events.add(event);
            }
        }
    }

    private static addLowPpO2(context: EventsContext, segment: PressureSegment): void {
        const gasCeiling = context.current.gas.ceiling(context.depthConverter.surfacePressure);
        const shouldAdd = (segment.minDepth < gasCeiling && context.switchingGas) ||
            (segment.startDepth > gasCeiling && gasCeiling > segment.endDepth && segment.isAscent) ||
            // only at beginning of a dive
            (context.current.startDepth === 0 && segment.startDepth < gasCeiling && segment.isDescent);

        // only crossing the line or gas switch
        if (shouldAdd) {
            const lowDepth = context.depthConverter.fromBar(gasCeiling);
            const event = EventsFactory.createLowPpO2(context.elapsed, lowDepth);
            context.events.add(event);
        }
    }

    /** Check only user defined segments break ceiling, because we trust the algorithm never breaks ceiling */
    private static validateBrokenCeiling(context: BrokenCeilingContext, ceilings: Ceiling[], segment: Segment): void {
        while (context.lastCeilingIndex < context.currentSegmentEndTime && context.lastCeilingIndex < ceilings.length - 1) {
            const ceiling = ceilings[context.lastCeilingIndex];
            context.lastCeilingIndex++;

            if (context.ceilingIsBroken(ceiling, segment)) {
                const event = EventsFactory.createBrokenCeiling(ceiling.time, ceiling.depth);
                context.add(event);
                break;
            }

            if (ceiling.time > context.currentSegmentEndTime) {
                break;
            }
        }
    }
}

class BrokenCeilingContext {
    public lastCeilingIndex = 0; // prevents search in past ceilings
    public currentSegmentStartTime = 0;
    public currentSegmentEndTime = 0;
    public eventAdded = false;

    constructor(private events: Events) {
    }

    public assignSegment(newSegment: Segment): void {
        this.currentSegmentStartTime = this.currentSegmentEndTime;
        this.currentSegmentEndTime += newSegment.duration;
    }

    public ceilingIsBroken(ceiling: Ceiling, segment: Segment): boolean {
        const duration = ceiling.time - this.currentSegmentStartTime;
        const diverDepth = segment.depthAt(duration);
        return ceiling.depth > diverDepth;
    }

    public add(event: Event): void {
        this.events.add(event);
        this.eventAdded = true;
    }
}

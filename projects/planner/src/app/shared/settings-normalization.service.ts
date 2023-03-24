import { Injectable } from '@angular/core';
import { Diver, Precision } from 'scuba-physics';
import { OptionsDispatcherService } from './options-dispatcher.service';
import { Plan } from './plan.service';
import { PlannerService } from './planner.service';
import { TanksService } from './tanks.service';
import { RangeConstants, UnitConversion } from './UnitConversion';

@Injectable()
export class SettingsNormalizationService {
    constructor(private planner: PlannerService,
        private options: OptionsDispatcherService,
        private units: UnitConversion,
        private tanksService: TanksService,
        private plan: Plan) { }

    private get ranges(): RangeConstants {
        return this.units.ranges;
    }

    public apply(diver: Diver, imperialUnits: boolean): void {
        this.units.imperialUnits = imperialUnits;
        this.planner.applyDiver(diver);
        this.applyToOptions(diver);
        this.normalizeTanks();
        this.normalizeSegments();
    }

    private applyToOptions(diver: Diver): void {
        this.options.applyDiver(diver);
        this.applyOptionsCalculationValues();
        this.normalizeOptions(this.ranges);
        this.planner.assignOptions(this.options);
    }

    private applyOptionsCalculationValues(): void {
        const defaults = this.units.defaults;
        // options need to be in metrics only
        this.options.decoStopDistance = this.units.toMeters(defaults.stopsDistance);
        // unable to fit the stop, the lowest value is always the minimum distance
        this.options.lastStopDepth = this.units.toMeters(defaults.stopsDistance);
        this.options.minimumAutoStopDepth = this.units.toMeters(defaults.autoStopLevel);
    }

    private normalizeOptions(ranges: RangeConstants): void {
        this.options.maxEND = this.fitLengthToRange(this.options.maxEND, ranges.narcoticDepth);
        this.options.altitude = this.fitLengthToRange(this.options.altitude, ranges.altitude);
        this.options.ascentSpeed50perc = this.fitLengthToRange(this.options.ascentSpeed50perc, ranges.speed);
        this.options.ascentSpeed50percTo6m = this.fitLengthToRange(this.options.ascentSpeed50percTo6m, ranges.speed);
        this.options.ascentSpeed6m = this.fitLengthToRange(this.options.ascentSpeed6m, ranges.speed);
        this.options.descentSpeed = this.fitLengthToRange(this.options.descentSpeed, ranges.speed);
    }

    private normalizeTanks(): void {
        const tanks = this.tanksService.tanks;
        tanks.forEach(t => {
            // cheating to skip the conversion to bars, since we already have the value in imperial units
            t.workingPressure = this.fitUnit(v => v, v => v, t.workingPressure, this.ranges.tankPressure);
            // the rest (consumed and reserve) will be calculated
            const tank = t.tank;
            tank.startPressure = this.fitPressureToRange(tank.startPressure, this.ranges.tankPressure);
            const workingPressureBars = this.units.toBar(t.workingPressure);
            tank.size = this.fitTankSizeToRange(tank.size, workingPressureBars, this.ranges.tankSize);
        });
    }

    private normalizeSegments(): void {
        const segments = this.plan.segments;
        segments.forEach(s => {
            s.startDepth = this.fitLengthToRange(s.startDepth, this.ranges.depth);
            s.endDepth = this.fitLengthToRange(s.endDepth, this.ranges.depth);
        });

        // fixes start depth back to surface after moved to UI range.
        this.plan.fixDepths();
    }

    private fitLengthToRange(meters: number, range: [number, number]): number {
        return this.fitUnit(v => this.units.fromMeters(v), v => this.units.toMeters(v), meters, range);
    }

    private fitPressureToRange(bars: number, range: [number, number]): number {
        return this.fitUnit(v => this.units.fromBar(v), v => this.units.toBar(v), bars, range);
    }

    private fitTankSizeToRange(size: number, workingPressureBars: number, range: [number, number]): number {
        return this.fitUnit(v => this.units.fromTankLiters(v, workingPressureBars),
            v => this.units.toTankLiters(v, workingPressureBars),
            size, range);
    }

    /** Ranges are in UI units, we are rounding for the UI */
    private fitUnit(fromMetric: (v: number) => number, toMetric: (v: number) => number,
        bars: number, range: [number, number]): number {
        let newValue = fromMetric(bars);
        newValue = Precision.round(newValue, 0);
        newValue = this.fitToRange(newValue, range[0], range[1]);
        return toMetric(newValue);
    }

    private fitToRange(current: number, minimum: number, maximum: number): number {
        if (current > maximum) {
            return maximum;
        }

        if (current < minimum) {
            return minimum;
        }

        return current;
    }
}

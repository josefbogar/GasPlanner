import { Tank } from 'scuba-physics';
import { UnitConversion } from './UnitConversion';
import { OptionsService } from './options.service';
import { Plan } from './plan.service';
import { TanksService } from './tanks.service';
import { Injectable } from '@angular/core';
import {DiveResults} from './diveresults';
import {DepthsService} from './depths.service';

export class DiveSchedule {
    /** In minutes or undefined in case it is the first dive */
    public surfaceInterval?: number;
    public _id = 0;
    private readonly _diveResult = new DiveResults();
    private readonly _plan: Plan = new Plan();
    private readonly _optionsService: OptionsService;
    private readonly _tanks: TanksService;
    private readonly _depths: DepthsService;

    constructor(index: number, private units: UnitConversion) {
        this.assignIndex(index);
        this._tanks = new TanksService(units);
        this._optionsService = new OptionsService(this.units);
        this._depths = new DepthsService(this.units, this.tanksService, this.plan, this._diveResult, this._optionsService);

        // this enforces to initialize the levels, needs to be called after subscribe to plan
        if (this.plan.maxDepth === 0) {
            let requiredDepth = this.units.defaults.stopsDistance * 10; // 30 m or 100 ft
            requiredDepth = this.units.toMeters(requiredDepth);
            const firstTank = this.firstTank;
            const options = this.optionsService.getOptions();
            this.plan.setSimple(requiredDepth, 12, firstTank, options);
        }
    }

    public get id(): number {
        return this._id;
    }

    public get tanksService(): TanksService {
        return this._tanks;
    }

    // TODO wrap Plan completely to DepthsService, so it is hidden
    public get plan(): Plan {
        return this._plan;
    }

    public get diveResult(): DiveResults {
        return this._diveResult;
    }

    public get depths(): DepthsService {
        return this._depths;
    }

    public get optionsService(): OptionsService {
        return this._optionsService;
    }

    public get title(): string {
        const depth = this.units.fromMeters(this.plan.maxDepth);
        const depthUnits = this.units.length;
        const duration = this.plan.duration;
        return `${this.id}. ${duration} min/${depth} ${depthUnits}`;
    }

    private get firstTank(): Tank {
        return this.tanksService.firstTank.tank;
    }

    public assignIndex(index: number): void {
        this._id = index + 1;
    }
}

@Injectable()
export class DiveSchedules {
    private _dives: DiveSchedule[] = [];
    private _selected: DiveSchedule;

    constructor(private units: UnitConversion) {
        this.add();
        this._selected = this._dives[0];
    }

    public get dives(): DiveSchedule[] {
        return this._dives.slice();
    }

    public get selected(): DiveSchedule {
        return this._selected;
    }

    public get length(): number {
        return this._dives.length;
    }

    public get empty(): boolean {
        return this.length <= 1;
    }

    public set selected(newValue: DiveSchedule) {
        if (this._dives.includes(newValue)) {
            this._selected = newValue;
        }
    }

    public add(): DiveSchedule {
        const newDive = this.createDiveSchedule();
        this._dives.push(newDive);
        this._selected = newDive;
        return newDive;
    }

    public remove(dive: DiveSchedule): void {
        if (!this.empty) {
            this._dives = this._dives.filter(g => g !== dive);
            this.renumber();
            this._selected = this._dives[0];
        }
    }

    public clear(): void {
        // there should always be at least one dive
        this._dives.splice(1, this._dives.length);
    }

    private createDiveSchedule(): DiveSchedule {
        return new DiveSchedule(this.length, this.units);
    }

    private renumber(): void {
        this._dives.forEach((dive, index) => {
            dive.assignIndex(index);
        });
    }
}
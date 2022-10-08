import { Component } from '@angular/core';
import { Dive } from '../shared/models';
import { PlannerService } from '../shared/planner.service';
import {
    faExclamationCircle, faExclamationTriangle, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import { Event, EventType, OtuCalculator } from 'scuba-physics';
import { UnitConversion } from '../shared/UnitConversion';

@Component({
    selector: 'app-dive-issues',
    templateUrl: './dive-issues.component.html',
    styleUrls: ['./dive-issues.component.css']
})
export class DiveIssuesComponent {
    public dive: Dive;
    public exclamation = faExclamationCircle;
    public warning = faExclamationTriangle;
    public info = faInfoCircle;
    public otuLimit = OtuCalculator.dailyLimit;

    constructor(private planner: PlannerService, public units: UnitConversion) {
        this.dive = this.planner.dive;
    }

    public get minimumDuration(): number {
        return this.planner.plan.duration + 1;
    }

    public get noDeco(): number {
        return this.planner.plan.noDecoTime;
    }

    public isLowPpO2(event: Event): boolean {
        return event.type === EventType.lowPpO2;
    }

    public isHighPpO2(event: Event): boolean {
        return event.type === EventType.highPpO2;
    }

    public isHighAscentSpeed(event: Event): boolean {
        return event.type === EventType.highAscentSpeed;
    }

    public isHighDescentSpeed(event: Event): boolean {
        return event.type === EventType.highDescentSpeed;
    }

    public isBrokenCeiling(event: Event): boolean {
        return event.type === EventType.brokenCeiling;
    }

    public isHighN2Switch(event: Event): boolean {
        return event.type === EventType.switchToHigherN2;
    }

    public isMndExceeded(event: Event): boolean {
        return event.type === EventType.maxEndExceeded;
    }

    public eventDepthFor(event: Event): number {
        return this.units.fromMeters(event.depth);
    }
}
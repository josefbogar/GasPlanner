import { DecimalPipe } from '@angular/common';
import { ComponentFixture, inject, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DepthsService } from '../shared/depths.service';
import { InputControls } from '../shared/inputcontrols';
import { OptionsDispatcherService } from '../shared/options-dispatcher.service';
import { PlannerService } from '../shared/planner.service';
import { WorkersFactoryCommon } from '../shared/serial.workers.factory';
import { UnitConversion } from '../shared/UnitConversion';
import { DepthsSimpleComponent } from './depths-simple.component';
import { ValidatorGroups } from '../shared/ValidatorGroups';
import { TanksService } from '../shared/tanks.service';
import { ViewSwitchService } from '../shared/viewSwitchService';
import { Plan } from '../shared/plan.service';
import { DelayedScheduleService } from '../shared/delayedSchedule.service';

export class SimpleDepthsPage {
    constructor(private fixture: ComponentFixture<DepthsSimpleComponent>) { }

    public get durationInput(): HTMLInputElement {
        return this.fixture.debugElement.query(By.css('#duration')).nativeElement as HTMLInputElement;
    }

    public get applyMaxDurationButton(): HTMLButtonElement {
        return this.fixture.debugElement.query(By.css('#btnApplyDuration')).nativeElement as HTMLButtonElement;
    }

    public get applyNdlButton(): HTMLButtonElement {
        return this.fixture.debugElement.query(By.css('#btnApplyNdl')).nativeElement as HTMLButtonElement;
    }
}

describe('Depths Simple Component', () => {
    let component: DepthsSimpleComponent;
    let depths: DepthsService;
    let fixture: ComponentFixture<DepthsSimpleComponent>;
    let simplePage: SimpleDepthsPage;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [DepthsSimpleComponent],
            imports: [ReactiveFormsModule],
            providers: [WorkersFactoryCommon, PlannerService,
                UnitConversion, InputControls, DelayedScheduleService,
                OptionsDispatcherService, ValidatorGroups,
                DepthsService, DecimalPipe, TanksService,
                ViewSwitchService, Plan
            ]
        })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(DepthsSimpleComponent);
        component = fixture.componentInstance;
        depths = component.depths;
        component.planner.calculate();
        fixture.detectChanges();
        simplePage = new SimpleDepthsPage(fixture);
        const scheduler = TestBed.inject(DelayedScheduleService);
        spyOn(scheduler, 'schedule')
            .and.callFake(() => {
                component.planner.calculate();
            });
    });

    it('Duration change enforces calculation', () => {
        simplePage.durationInput.value = '20';
        simplePage.durationInput.dispatchEvent(new Event('input'));
        expect(depths.planDuration).toBe(20);
    });

    describe('Simple view', () => {
        describe('Duration reloaded enforced by', () => {
            it('Apply max NDL', () => {
                simplePage.applyNdlButton.click();
                expect(simplePage.durationInput.value).toBe('13');
            });

            it('Apply max duration', () => {
                simplePage.applyMaxDurationButton.click();
                expect(simplePage.durationInput.value).toBe('19');
            });

            xit('Switch to simple view', inject([ViewSwitchService], (viewSwitch: ViewSwitchService) => {
                viewSwitch.isComplex = true;
                fixture.detectChanges();
                // TODO makes still sense?
                // complexPage.durationInput(1).value = '20';
                // complexPage.durationInput(1).dispatchEvent(new Event('input'));
                expect(depths.planDuration).toBe(21.7);
            }));
        });

        it('wrong duration doesn\'t call calculate', () => {
            const durationSpy = spyOnProperty(depths, 'planDuration')
                .and.callThrough();

            simplePage.durationInput.value = 'aaa';
            simplePage.durationInput.dispatchEvent(new Event('input'));
            expect(durationSpy).not.toHaveBeenCalled();
        });
    });

    describe('Max narcotic depth', () => {
        it('Is calculated 30 m for Air with 30m max. narcotic depth option', inject(
            [PlannerService, Plan],
            (planner: PlannerService, plan: Plan) => {
                depths.applyMaxDepth();
                expect(plan.maxDepth).toBe(30);
            }));

        it('Max narcotic depth is applied', inject([PlannerService, TanksService, Plan],
            (planner: PlannerService, tanksService: TanksService, plan: Plan) => {
                tanksService.firstTank.o2 = 50;
                depths.applyMaxDepth();
                expect(plan.maxDepth).toBe(18);
            }));
    });

    describe('Imperial Units', () => {
        beforeEach(() => {
            component.units.imperialUnits = true;
        });

        it('Updates end depth', () => {
            const last = depths.levels[1];
            last.endDepth = 70;
            const result = last.segment.endDepth;
            expect(result).toBeCloseTo(21.336, 6);
        });

        it('Converts start depth', () => {
            const last = depths.levels[1];
            last.segment.startDepth = 6.096;
            expect(last.startDepth).toBeCloseTo(20, 6);
        });

        it('Adjusts tank label', () => {
            const last = depths.levels[1];
            const tank = last.tank;
            tank.startPressure = 3000;
            tank.workingPressure = 3000;
            tank.size = 100;
            expect(last.tankLabel).toBe('1. Air/100/3000');
        });
    });
});
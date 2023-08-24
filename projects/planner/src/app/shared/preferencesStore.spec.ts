import { TestBed, inject } from '@angular/core/testing';
import { PreferencesStore } from './preferencesStore';
import { PlannerService } from './planner.service';
import { Diver, Options, Tank, Salinity, SafetyStop } from 'scuba-physics';
import { OptionExtensions } from '../../../../scuba-physics/src/lib/Options.spec';
import { WorkersFactoryCommon } from './serial.workers.factory';
import { OptionsService } from './options.service';
import { TanksService } from './tanks.service';
import { UnitConversion } from './UnitConversion';
import { ViewSwitchService } from './viewSwitchService';
import { Plan } from './plan.service';
import { DepthsService } from './depths.service';
import { DelayedScheduleService } from './delayedSchedule.service';
import { TestBedExtensions } from './TestBedCommon.spec';
import { Preferences } from './preferences';
import { SettingsNormalizationService } from './settings-normalization.service';
import { WayPointsService } from './waypoints.service';
import { ViewStates } from './viewStates';

describe('PreferencesStore', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [WorkersFactoryCommon,
                PreferencesStore, PlannerService,
                UnitConversion, TanksService,
                ViewSwitchService, DepthsService,
                OptionsService, Plan, Preferences,
                DelayedScheduleService, SettingsNormalizationService,
                WayPointsService, ViewStates
            ]
        });

        localStorage.clear();
        TestBedExtensions.initPlan();
    });

    it('loads saved disclaimer', inject([PreferencesStore, PlannerService],
        (service: PreferencesStore) => {
            service.disableDisclaimer();
            const enabled = service.disclaimerEnabled();
            expect(enabled).toBeFalsy();
        }));

    describe('Preferences', () => {
        it('Diver values are loaded after save', inject([PreferencesStore, OptionsService],
            (service: PreferencesStore, options: OptionsService) => {
                const diver = options.diver;
                diver.rmv = 10;
                diver.maxPpO2 = 1.1;
                diver.maxDecoPpO2 = 1.5;
                service.save();

                diver.rmv = 10;
                diver.maxPpO2 = 1.3;
                diver.maxDecoPpO2 = 1.4;
                service.load();

                const expected = new Diver(10, 1.1);
                expected.maxDecoPpO2 = 1.5;
                expect(diver).toEqual(expected);
            }));

        it('Options values are loaded after save', inject([PreferencesStore, OptionsService, ViewSwitchService],
            (service: PreferencesStore, options: OptionsService, viewSwitch: ViewSwitchService) => {
                // not going to test all options, since it is a flat structure
                options.gfLow = 0.3;
                options.descentSpeed = 15;
                viewSwitch.isComplex = true; // otherwise reset of GF.
                service.save();

                options.gfLow = 0.35;
                options.descentSpeed = 17;
                service.load();

                const expected = new Options(0.3, 0.85, 1.4, 1.6, Salinity.fresh);
                expected.descentSpeed = 15;
                expected.safetyStop = SafetyStop.auto;
                expect(options.getOptions()).toEqual(expected);
            }));

        it('Tanks are loaded after save', inject(
            [PreferencesStore, PlannerService, TanksService,
                OptionsService, ViewSwitchService, Plan],
            (service: PreferencesStore, planner: PlannerService,
                tanksService: TanksService, options: OptionsService,
                viewSwitch: ViewSwitchService, plan: Plan) => {
                // setup needed for consumed calculation
                const oValues = options.getOptions();
                OptionExtensions.applySimpleSpeeds(oValues);
                options.safetyStop = SafetyStop.always;
                options.gasSwitchDuration = 1;
                options.problemSolvingDuration = 2;
                plan.setSimple(30, 12, tanksService.firstTank.tank, oValues);

                tanksService.addTank();
                const tanks = tanksService.tanks;
                tanks[0].startPressure = 150;
                tanks[1].o2 = 50;
                viewSwitch.isComplex = true; // otherwise the tank will be removed.
                planner.calculate();
                service.save();

                tanks[0].startPressure = 130;
                tanks[1].o2 = 32;
                tanks[1].workingPressure = 0;
                service.load();

                const expected1 = new Tank(15, 150, 21);
                expected1.id = 1;
                expected1.consumed = 66;
                expected1.reserve = 45;
                const expected2 = new Tank(11.1, 200, 50);
                expected2.id = 2;
                expected2.consumed = 21;
                expected2.reserve = 62;
                // JSON serialization prevents order of items in an array
                const expected: Tank[] = [expected1, expected2];
                expect(tanksService.tankData).toEqual(expected);
                expect(tanksService.tanks[0].workingPressureBars).toBeCloseTo(0, 6);
                expect(tanksService.tanks[1].workingPressureBars).toBeCloseTo(0, 6);
            }));

        it('Plan is loaded after save', inject(
            [PreferencesStore, PlannerService, TanksService, ViewSwitchService, DepthsService, Plan],
            (service: PreferencesStore, planner: PlannerService,
                tanksService: TanksService, viewSwitch: ViewSwitchService,
                depthsService: DepthsService, plan: Plan) => {
                tanksService.addTank();
                tanksService.addTank();
                depthsService.addSegment();
                const lastSegment = plan.segments[2];
                const secondTank = tanksService.tanks[1];
                lastSegment.tank = secondTank.tank;
                viewSwitch.isComplex = true;
                planner.calculate();
                service.save();

                plan.removeSegment(lastSegment);
                tanksService.removeTank(secondTank);
                service.load();

                expect(tanksService.tanks.length).toEqual(3);
                expect(plan.length).toEqual(3);
                expect(plan.segments[2].tank?.id).toEqual(2);
            }));

        it('Simple profile is loaded after save and trims tank', inject(
            [PreferencesStore, PlannerService, TanksService, DepthsService, Plan, OptionsService],
            (service: PreferencesStore, planner: PlannerService, tanksService: TanksService,
                depthsService: DepthsService, plan: Plan, options: OptionsService) => {
                const optionsResetToSimple = spyOn(options, 'resetToSimple').and.callThrough();

                // invalid operations for simple profile simulate wrong data
                tanksService.addTank();
                tanksService.addTank();
                depthsService.addSegment();
                planner.calculate();
                service.save();

                service.load();

                expect(tanksService.tanks.length).toEqual(1);
                expect(plan.length).toEqual(2);
                expect(optionsResetToSimple).toHaveBeenCalledTimes(1);
            }));

        it('Applies imperial units', inject(
            [PreferencesStore, UnitConversion, OptionsService, SettingsNormalizationService, TanksService],
            (service: PreferencesStore, units: UnitConversion, options: OptionsService,
                normalizationService: SettingsNormalizationService, tanksService: TanksService) => {
                units.imperialUnits = true;
                options.diver.rmv = 29.998867;
                normalizationService.apply();
                service.save();

                units.imperialUnits = false;
                options.diver.rmv = 19.6;
                normalizationService.apply();
                service.load();

                expect(options.diver.rmv).toBeCloseTo(29.998867, 6);
                expect(tanksService.tanks[0].workingPressureBars).toBeCloseTo(237.317546, 6);
                expect(units.imperialUnits).toBeTruthy();
            }));
    });
});
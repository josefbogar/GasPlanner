import { OptionsDispatcherService } from './options-dispatcher.service';
import { Plan } from './plan.service';
import { PlannerService } from './planner.service';
import { PlanUrlSerialization } from './PlanUrlSerialization';
import { WorkersFactoryCommon } from './serial.workers.factory';
import { TanksService } from './tanks.service';
import { UnitConversion } from './UnitConversion';
import { ViewSwitchService } from './viewSwitchService';

describe('Url Serialization', () => {
    const irrelevantFactory = new WorkersFactoryCommon();
    let options: OptionsDispatcherService;
    let plan: Plan;
    let defaultPlan: PlannerService;
    let planner: PlannerService;
    let tanksService: TanksService;
    let customizedUrl: string;
    let viewSwitch: ViewSwitchService;
    let sut: PlanUrlSerialization;
    const createPlanner = () => new PlannerService(irrelevantFactory, tanksService, new Plan());

    beforeEach(() => {
        tanksService = new TanksService(new UnitConversion());
        tanksService.addTank();
        plan = new Plan();
        options = new OptionsDispatcherService();
        defaultPlan = createPlanner();
        planner =  createPlanner();
        viewSwitch = new ViewSwitchService(planner, plan, options, tanksService);
        viewSwitch.isComplex = true;
        planner.addSegment();
        planner.calculate();

        sut = new PlanUrlSerialization(planner, tanksService, viewSwitch, options, plan);
        customizedUrl = sut.toUrl();
    });

    const expectParsedEquals = (expected: PlannerService, current: PlannerService,
        expectedIsComplex: boolean, currentIsComplex: boolean): void => {
        const toExpect = {
            plan: plan.segments,
            tansk: tanksService.tankData,
            diver: expected.diver,
            options: expected.options,
            isComplex: expectedIsComplex
        };

        const toCompare = {
            plan: plan.segments, // TODO ensure correct plan is used
            tansk: tanksService.tankData,
            diver: current.diver,
            options: current.options,
            isComplex: currentIsComplex
        };

        expect(toCompare).toEqual(toExpect);
    };

    it('Generates valid url characters', () => {
        const urlParams = sut.toUrl();
        const isValid = /[-a-zA-Z0-9@:%_+.~#&//=]*/g.test(urlParams);
        expect(isValid).toBeTruthy();
    });

    it('Serialize and deserialize complex plan', () => {
        const current = createPlanner();
        // TODO check, if viewSwitch and tank service should be also new instances.
        new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan)
            .fromUrl(customizedUrl);
        expectParsedEquals(planner, current, viewSwitch.isComplex, true);
    });

    it('Serialize and deserialize simple plan', () => {
        const source = createPlanner();
        tanksService.tanks[0].size = 18;
        source.calculate();
        const urlParams = sut.toUrl();
        const current = createPlanner();
        new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan)
            .fromUrl(urlParams);
        expectParsedEquals(source, current, viewSwitch.isComplex, true);
    });

    it('Decodes url for facebook link', () => {
        const encodedParams = encodeURIComponent(customizedUrl);
        const current = createPlanner();
        new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan).fromUrl(encodedParams);
        expectParsedEquals(current, planner, viewSwitch.isComplex, true);
    });

    describe('Skips loading', () => {
        it('Invalid url values', () => {
            // 2 tanks in simple mode, which isn't valid
            const urlParams = 't=1-15-200-0.209-0,2-11-200-0.5-0&de=0-30-102-1,30-30-618-1&' +
                'di=20,1.4,1.6&o=0,9,6,3,3,18,2,0.85,0.4,3,1.6,30,1.4,10,1,1,0,2,1&c=0';
            const current = createPlanner();
            new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan)
                .fromUrl(urlParams);
            expectParsedEquals(current, defaultPlan, viewSwitch.isComplex, true);
        });

        it('Empty string', () => {
            const current = createPlanner();
            new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan)
                .fromUrl('');
            expectParsedEquals(current, defaultPlan, viewSwitch.isComplex, true);
        });

        it('Null string', () => {
            const planUrl: unknown = null;
            const current = createPlanner();
            new PlanUrlSerialization(current, tanksService, viewSwitch, options, plan)
                .fromUrl(<string>planUrl);
            expectParsedEquals(current, defaultPlan, viewSwitch.isComplex, true);
        });
    });
});

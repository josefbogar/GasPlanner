import {Component} from '@angular/core';
import {WayPointsService} from '../shared/waypoints.service';
import {UnitConversion} from '../shared/UnitConversion';
import {Segments, StandardGases, Tank, Time} from 'scuba-physics';
import {WayPoint} from '../shared/models';
import {TestDataJsonProvider} from './testData/TestDataJsonProvider';
import {TestDataInjector} from './testData/testDataInjector';
import {ProfileComparatorService} from '../shared/profileComparatorService';

export class TestData {
    public readonly wayPointsA: WayPoint[];
    public readonly tanksA: Tank[];

    public readonly wayPointsB: WayPoint[];
    public readonly tanksB: Tank[];

    private testDataProvider = new TestDataJsonProvider();
    constructor(private testDataInjector: TestDataInjector) {
        const units = new UnitConversion();
        const waypointService = new WayPointsService(units);

        this.tanksA = [
            new Tank(24, 200, 21),
            new Tank(11, 200, 50),
            new Tank(11, 150, 100),
        ];
        this.tanksA[0].consumed = 120;
        this.tanksA[1].consumed = 80;
        this.tanksA[2].consumed = 60;

        const segmentsA = new Segments();
        segmentsA.add(0, 40, StandardGases.air, Time.oneMinute * 2);
        segmentsA.add(40, 40, StandardGases.air, Time.oneMinute * 10);
        segmentsA.add(40, 21, StandardGases.air, Time.oneMinute * 2);
        segmentsA.add(21, 21, StandardGases.ean50, Time.oneMinute);
        segmentsA.add(21, 3, StandardGases.ean50, Time.oneMinute * 3);
        segmentsA.add(3, 3, StandardGases.oxygen, Time.oneMinute * 6);
        segmentsA.add(3, 0, StandardGases.oxygen, Time.oneMinute);
        this.wayPointsA = waypointService.calculateWayPoints(segmentsA.items);

        this.tanksB = [
            new Tank(24, 200, 21),
            new Tank(11, 200, 50)
        ];
        this.tanksB[0].consumed = 90;
        this.tanksB[1].consumed = 40;

        const segmentsB = new Segments();
        segmentsB.add(0, 30, StandardGases.air, Time.oneMinute * 4);
        segmentsB.add(30, 30, StandardGases.air, Time.oneMinute * 10);
        segmentsB.add(30, 15, StandardGases.air, Time.oneMinute * 3);
        segmentsB.add(15, 15, StandardGases.ean50, Time.oneMinute);
        segmentsB.add(15, 0, StandardGases.ean50, Time.oneMinute * 2);
        this.wayPointsB = waypointService.calculateWayPoints(segmentsB.items);
        // this.testDataInjector.injectProfiles(0, 1);
    }
}

@Component({
    selector: 'app-diff',
    templateUrl: './diff.component.html',
    styleUrls: ['./diff.component.scss']
})
export class DiffComponent {
    public testData = new TestData(this.testDataInjector);
    constructor(private testDataInjector: TestDataInjector, public profileComparatorService: ProfileComparatorService) {
    }
}

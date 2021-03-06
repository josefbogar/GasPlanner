import { Component } from '@angular/core';
import { faBatteryHalf, faTrashAlt, faPlusSquare } from '@fortawesome/free-solid-svg-icons';

import { PlannerService } from '../shared/planner.service';
import { StandardGases, Tank, Diver } from 'scuba-physics';

@Component({
    selector: 'app-tanks',
    templateUrl: './tanks.component.html',
    styleUrls: ['./tanks.component.css']
})
export class TanksComponent {
    public firstTank: Tank;
    public gasNames: string[];
    public icon = faBatteryHalf;
    public plusIcon = faPlusSquare;
    public trashIcon = faTrashAlt;
    private diver: Diver;

    constructor(private planner: PlannerService) {
        this.firstTank = this.planner.firstTank;
        this.diver = this.planner.diver;
        this.gasNames = StandardGases.gasNames();
    }

    public get tanks(): Tank[] {
        return this.planner.tanks;
    }

    public get isTechnical(): boolean {
        return this.planner.isTechnical;
    }

    public get o2(): number {
        return this.firstTank.o2;
    }

    public set o2(newValue) {
        this.firstTank.o2 = newValue;
    }

    public gasSac(gas: Tank): number {
        return this.diver.gasSac(gas);
    }

    public addGas(): void {
        this.planner.addGas();
    }

    public removeGas(gas: Tank): void {
        this.planner.removeGas(gas);
    }

    public assignBestMix(): void {
        this.o2 = this.planner.bestNitroxMix();
    }

    public gasChanged(): void {
        this.planner.calculate();
    }

    public assignStandardGas(gas: Tank, gasName: string): void {
        gas.assignStandardGas(gasName);
        this.gasChanged();
    }
}
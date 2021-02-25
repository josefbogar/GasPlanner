import { Component, Input } from '@angular/core';
import { PlannerService } from '../shared/planner.service';
import { Tank } from '../shared/models';

@Component({
  selector: 'app-gaslabel',
  templateUrl: './gaslabel.component.html',
  styleUrls: ['./gaslabel.component.css']
})
export class GaslabelComponent {

  @Input()
  public gas: Tank;

  public get gasMod(): number {
    return this.planer.modForGas(this.gas);
  }

  public get gasDecoMod(): number {
    return this.planer.switchDepth(this.gas);
  }

  constructor(private planer: PlannerService) { }
}

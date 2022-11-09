import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OptionDefaults } from 'scuba-physics';
import { InputControls } from '../shared/inputcontrols';
import { Gradients, StandardGradientsService } from '../shared/standard-gradients.service';

@Component({
    selector: 'app-gradients',
    templateUrl: './gradients.component.html',
    styleUrls: ['./gradients.component.css']
})
export class GradientsComponent implements OnInit {
    @Input()
    public showTitle = false;
    @Input()
    public simple = false;

    @Input()
    public gfLow = OptionDefaults.gfLow;
    @Input()
    public gfHigh = OptionDefaults.gfHigh;

    @Output()
    public inputChange = new EventEmitter<Gradients>();
    public standards = new StandardGradientsService();
    public gfForm!: FormGroup;

    constructor(private fb: FormBuilder,
        private numberPipe: DecimalPipe) { }

    public get conservatism(): string {
        return this.standards.labelFor(this.gfLow, this.gfHigh);
    }

    public get gfLowInvalid(): boolean {
        const gfLowField = this.gfForm.controls.gfLow;
        return InputControls.controlInValid(gfLowField);
    }

    public get gfHighInvalid(): boolean {
        const gfHighField = this.gfForm.controls.gfHigh;
        return InputControls.controlInValid(gfHighField);
    }

    public gfHighChanged(): void {
        if(this.gfHighInvalid) {
            return;
        }

        const newValue = Number(this.gfForm.controls.gfHigh.value);
        this.gfHigh = newValue / 100;
        this.inputChange.emit(new Gradients(this.gfLow, this.gfHigh));
    }

    public gfLowChanged(): void {
        if(this.gfLowInvalid) {
            return;
        }

        const newValue = Number(this.gfForm.controls.gfLow.value);
        this.gfLow = newValue / 100;
        this.inputChange.emit(new Gradients(this.gfLow, this.gfHigh));
    }

    public ngOnInit(): void {
        this.gfForm = this.fb.group({
            gfLow: [InputControls.formatNumber(this.numberPipe, this.gfLow * 100),
                [Validators.required, Validators.min(10), Validators.max(100)]],
            gfHigh: [InputControls.formatNumber(this.numberPipe, this.gfHigh * 100),
                [Validators.required, Validators.min(10), Validators.max(100)]]
        });
    }

    public lowConservatism(): void {
        this.applyStandards(this.standards.lowName);
    }

    public mediumConservatism(): void {
        this.applyStandards(this.standards.mediumName);
    }

    public highConservatism(): void {
        this.applyStandards(this.standards.highName);
    }

    private applyStandards(label: string): void {
        const toApply = this.standards.get(label);
        this.gfLow = toApply.gfLow;
        this.gfHigh = toApply.gfHeigh;
        this.gfForm.patchValue({
            gfLow: InputControls.formatNumber(this.numberPipe, this.gfLow * 100),
            gfHigh: InputControls.formatNumber(this.numberPipe, this.gfHigh * 100),
            conservatism: this.conservatism
        });
        this.inputChange.emit(new Gradients(this.gfLow, this.gfHigh));
    }
}

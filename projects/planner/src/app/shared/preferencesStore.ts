import { Injectable } from '@angular/core';
import { PlannerService } from './planner.service';
import { Preferences } from './preferences';
import { AppPreferences } from './serialization.model';

@Injectable()
export class PreferencesStore {
    private static readonly disclaimerValue = 'confirmed';
    private static readonly storageKey = 'preferences';
    private static readonly disclaimerKey = 'disclaimer';

    constructor(
        private planner: PlannerService,
        private preferencesFactory: Preferences) {}

    public load(): void {
        const toParse = localStorage.getItem(PreferencesStore.storageKey);
        if (!toParse) {
            return;
        }

        const loaded = JSON.parse(toParse) as AppPreferences;
        this.preferencesFactory.applyApp(loaded);
        this.planner.calculate();
    }

    public loadDefault(): void {
        // TODO load default
    }

    public save(): void {
        const toSave = this.preferencesFactory.toPreferences();
        const serialized = JSON.stringify(toSave);
        localStorage.setItem(PreferencesStore.storageKey, serialized);
    }

    public saveDefault(): void {
        // TODO save default
    }

    public disableDisclaimer(): void {
        localStorage.setItem(PreferencesStore.disclaimerKey, PreferencesStore.disclaimerValue);
    }

    public disclaimerEnabled(): boolean {
        const saved = localStorage.getItem(PreferencesStore.disclaimerKey);
        return saved !== PreferencesStore.disclaimerValue;
    }
}
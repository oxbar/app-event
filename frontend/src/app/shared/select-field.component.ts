import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TuiChevron, TuiDataListWrapper, TuiSelect} from '@taiga-ui/kit';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'app-select-field',
  standalone: true,
  imports: [ReactiveFormsModule, TuiChevron, TuiDataListWrapper, TuiSelect],
  template: `
    <tui-textfield tuiChevron [stringify]="stringify" [tuiTextfieldCleaner]="false">
      <input
        tuiSelect
        [id]="inputId()"
        [formControl]="control()"
        [placeholder]="placeholder()"
        [attr.aria-label]="ariaLabel() || placeholder()"
      />
      <tui-data-list-wrapper
        *tuiDropdown
        [items]="values()"
        [itemContent]="optionContent"
      />
    </tui-textfield>

    <ng-template #optionContent let-value>
      {{labelFor(value)}}
    </ng-template>
  `,
  styles: [':host{display:block;min-width:0}'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('Selecione uma opção');
  readonly ariaLabel = input('');
  readonly inputId = input('');

  readonly values = computed(() => this.options().map(option => option.value));

  readonly stringify = (value: string): string => this.labelFor(value);

  labelFor(value: string): string {
    return this.options().find(option => option.value === value)?.label ?? value;
  }
}

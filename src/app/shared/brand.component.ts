import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'mp-brand',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="brand" routerLink="/" aria-label="Food Waste Matcher AI home">
      <span class="brand-mark"><img src="/food-waste-matcher-mark.png" alt="" /></span>
      @if (!compact()) { <span>Food Waste Matcher AI</span> }
    </a>
  `
})
export class BrandComponent {
  readonly compact = input(false);
}

import { inject, Injectable } from '@angular/core';
import { DonationExtraction, DonationHandoff, DonationHandoffInput } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AiExtractionService {
  private readonly supabase = inject(SupabaseService);

  async extract(input: string): Promise<DonationExtraction> {
    if (this.supabase.client) {
      const { data, error, response } = await this.supabase.client.functions.invoke<DonationExtraction>('extract-donation', { body: { text: input.slice(0, 4000) } });
      if (response?.status === 429) throw new Error('The AI helper is busy right now. Wait a minute and try again, or continue with the Manual form.');
      if (response?.status === 401) throw new Error('Your session has expired. Log in again, or use the Manual form.');
      if (response?.status === 403) throw new Error('AI assist is not enabled for this website address yet. Use the Manual form for now.');
      if (error || !data) throw new Error('The AI helper is temporarily unavailable. Continue with the Manual form—your food post is not blocked.');
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 650));
    return {
      foodName: 'Vegetable biryani & dal',
      meals: 35,
      category: 'Cooked meal',
      dietary: 'Vegetarian',
      preparedAt: 'Today, 8:00 PM',
      pickupBy: 'Today, 10:00 PM',
      outlet: 'Viviana Mall pickup point',
      address: 'Dolmen Mall, Clifton',
      notes: 'Packed in food-grade containers. Two serving spoons included.',
      missing: [],
      confidence: 0.92
    };
  }

  async prepareHandoff(input: DonationHandoffInput): Promise<DonationHandoff> {
    if (this.supabase.client) {
      const { data, error, response } = await this.supabase.client.functions.invoke<DonationHandoff>('extract-donation', {
        body: { mode: 'handoff', donation: input }
      });
      if (response?.status === 429) throw new Error('The AI helper is busy right now. Wait a minute and try again, or post without a handoff brief.');
      if (response?.status === 401) throw new Error('Your session has expired. Log in again before preparing the handoff.');
      if (response?.status === 403) throw new Error('AI assist is not enabled for this website address yet.');
      if (response?.status === 400) throw new Error('The AI handoff helper is being updated. You can still post this food without a brief.');
      if (error || !data) throw new Error('The AI handoff helper is temporarily unavailable. You can still post this food without a brief.');
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    return this.demoHandoff(input);
  }

  private demoHandoff(input: DonationHandoffInput): DonationHandoff {
    const location = [input.outlet, input.address, input.city, input.pincode].filter(Boolean).join(', ');
    return {
      pickupSummary: `${input.meals} ${input.dietary.toLowerCase()} meals of ${input.foodName} are available from ${location}. Pickup is requested by ${input.pickupBy}.`,
      checklist: ['Confirm your team can arrive before the pickup deadline.', 'Bring suitable containers if the donor has not confirmed packaging.', 'Call the food partner after accepting to confirm arrival timing.'],
      missing: input.notes ? [] : ['Handling notes'],
      ngoMessage: `Hello, we are interested in collecting ${input.meals} meals of ${input.foodName}. Please confirm the pickup timing and any collection instructions.`
    };
  }
}

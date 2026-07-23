import { RegisteredModel } from './types';

class ModelRegistry {
  private models = new Map<string, RegisteredModel>();

  register(model: RegisteredModel): void {
    this.models.set(model.id, model);
  }

  get(id: string): RegisteredModel | undefined {
    return this.models.get(id);
  }

  getAll(): RegisteredModel[] {
    return Array.from(this.models.values());
  }

  getByOutputType(type: 'number_array' | 'category_map'): RegisteredModel[] {
    return this.getAll().filter(m => m.outputType === type);
  }

  getByCategory(category: string): RegisteredModel[] {
    return this.getAll().filter(m => m.categories?.includes(category));
  }
}

export const modelRegistry = new ModelRegistry();

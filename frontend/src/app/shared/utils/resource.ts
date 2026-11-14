import { Resource } from '@angular/core';

// value() throws while a resource is in error, so read through this to fall back safely.
export const valueOr = <T>(resource: Resource<T>, fallback: T): T => (resource.hasValue() ? resource.value() : fallback);

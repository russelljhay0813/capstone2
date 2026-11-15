export interface LocationOption {
  code: string;
  name: string;
}

const PSGC_API = "https://psgc.gitlab.io/api";

async function fetchLocations(path: string): Promise<LocationOption[]> {
  const response = await fetch(`${PSGC_API}/${path}`);
  if (!response.ok) throw new Error(`Unable to load locations (${response.status})`);
  const locations = (await response.json()) as Array<{ code: string; name: string }>;
  return locations
    .map(({ code, name }) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function fetchRegions() {
  return fetchLocations("regions");
}

export function fetchProvinces(regionCode: string) {
  return fetchLocations(`regions/${encodeURIComponent(regionCode)}/provinces`);
}

export function fetchCities(provinceCode: string) {
  return fetchLocations(`provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`);
}

export function fetchBarangays(cityCode: string) {
  return fetchLocations(`cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);
}
         
// Namespaced identifiers, Minecraft-style: "namespace:id" (e.g. "terrath:grass",
// "my_mod:ruby_ore"). The base game content uses the reserved "terrath" namespace.
//
// References inside data files may be written unqualified ("grass"); they are
// resolved against a default namespace (the owning content's namespace). So a
// mod's file can say "grass" to mean its own grass, or "terrath:grass" to point
// at the base game's grass explicitly.

export const BASE_NAMESPACE = 'terrath';

// Resolves a possibly-unqualified reference to a full "ns:id".
//   resolveId("grass", "terrath")        -> "terrath:grass"
//   resolveId("my_mod:ore", "terrath")   -> "my_mod:ore"  (already qualified)
export function resolveId(ref: string, defaultNs: string = BASE_NAMESPACE): string {
    return ref.includes(':') ? ref : `${defaultNs}:${ref}`;
}

// Splits a full id into its parts. "terrath:grass" -> { namespace, id }.
export function splitId(fullId: string): { namespace: string; id: string } {
    const idx = fullId.indexOf(':');
    if (idx === -1) return { namespace: BASE_NAMESPACE, id: fullId };
    return { namespace: fullId.slice(0, idx), id: fullId.slice(idx + 1) };
}

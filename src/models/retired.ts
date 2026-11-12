/** A component deleted while evaluations used it: the engine keeps it for their record, and it is not offered
 *  for new runs until it is restored. */
type MayBeRetired = { retired_at?: string | null };

export const isRetired = (c: MayBeRetired): boolean => !!c.retired_at;

/** The components a new run may use. */
export const inUse = <T extends MayBeRetired>(list: T[]): T[] => list.filter(c => !isRetired(c));

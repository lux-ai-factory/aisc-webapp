// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { installRequestBody, openPublicCatalogue, parseInstallUri, parseInstallUris } from './installUri';

// The catalogue is the only place plugins are discovered, so an install that
// arrives here must say which catalogue entry it came from. The slug is that
// identity: the engine stores it so an installed distribution can be traced
// back to the entry, its tags and its controls.
describe('parseInstallUris', () => {
  it('keeps the catalogue slug that came with the package', () => {
    expect(
      parseInstallUris('web+aiscplugin://enable?package=aisc-plugin-langbite&version=0.1.2&slug=langbite'),
    ).toEqual([
      {
        package: 'aisc-plugin-langbite',
        version: '0.1.2',
        slug: 'langbite',
        uri: 'web+aiscplugin://enable?package=aisc-plugin-langbite&version=0.1.2&slug=langbite',
      },
    ]);
  });

  it('leaves the slug out when the catalogue did not send one', () => {
    const [entry] = parseInstallUris('web+aiscplugin://enable?package=p&version=1.0.0');
    expect(entry.package).toBe('p');
    expect(entry.slug).toBeUndefined();
  });

  it('un-escapes the slug', () => {
    const [entry] = parseInstallUris('web+aiscplugin://enable?package=p&version=1&slug=a%2Fb');
    expect(entry.slug).toBe('a/b');
  });

  it('aligns each slug with its own package in a batch', () => {
    // The middle entry has no slug, so a naive "all packages / all slugs" pair
    // would hand the third entry's slug to the second one.
    const entries = parseInstallUris(
      'web+aiscplugin://enable?package=a&version=1&slug=first' +
        '&package=b&version=2' +
        '&package=c&version=3&slug=third',
    );
    expect(entries.map((e) => [e.package, e.version, e.slug])).toEqual([
      ['a', '1', 'first'],
      ['b', '2', undefined],
      ['c', '3', 'third'],
    ]);
  });

  it('ignores a slug that belongs to no package', () => {
    expect(parseInstallUris('web+aiscplugin://enable?slug=orphan')).toEqual([]);
  });

  it('still refuses an entry without a version', () => {
    expect(parseInstallUris('web+aiscplugin://enable?package=p&slug=s')).toEqual([]);
  });
});

describe('parseInstallUri', () => {
  it('carries the slug of the single entry', () => {
    expect(parseInstallUri('web+aiscplugin://enable?package=p&version=1&slug=s')?.slug).toBe('s');
  });
});

// What the dialog posts to the engine. Kept as a pure function so the body the
// engine receives is asserted here rather than inferred from the component.
describe('installRequestBody', () => {
  it('sends the catalogue entry alongside the coordinates', () => {
    expect(
      installRequestBody(
        { package: 'aisc-plugin-langbite', version: '0.1.2', slug: 'langbite', uri: 'x' },
        'a2c1e0f4-0000-4000-8000-000000000000',
      ),
    ).toEqual({
      package_name: 'aisc-plugin-langbite',
      version: '0.1.2',
      project_uuid: 'a2c1e0f4-0000-4000-8000-000000000000',
      catalogue_slug: 'langbite',
    });
  });

  it('omits the entry rather than sending a null one', () => {
    const body = installRequestBody(
      { package: 'p', version: '1', uri: 'x' },
      'a2c1e0f4-0000-4000-8000-000000000000',
    );
    expect(body).not.toHaveProperty('catalogue_slug');
    expect(body.package_name).toBe('p');
  });
});

describe('openPublicCatalogue', () => {
  it('sends the controls address and the current project with the handshake', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    window.history.replaceState(null, '', '/?project=0b8e7d3c-1f2a-4b5c-9d6e-7f8a9b0c1d2e');
    openPublicCatalogue();
    const url = open.mock.calls[0][0] as string;
    const payload = JSON.parse(atob(url.split('#env=')[1]));
    expect(payload.url).toBe(window.location.origin);
    expect(payload.controls).toBe(`${window.location.origin}/controls`);
    expect(payload.project).toBe('0b8e7d3c-1f2a-4b5c-9d6e-7f8a9b0c1d2e');
    vi.unstubAllGlobals();
  });
});

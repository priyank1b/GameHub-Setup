async function fetchStoreMetadataByStoreId(storeId) {
  try {
    const url = `https://displaycatalog.mp.microsoft.com/v7/products/${storeId}?market=US&languages=en-US`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const product = data.Product;
    const props = product?.LocalizedProperties?.[0];
    const images = props?.Images || [];

    let coverImage = images.find(i => i.ImagePurpose === 'Poster')?.Uri;
    if (!coverImage) coverImage = images.find(i => i.ImagePurpose === 'BoxArt')?.Uri;
    if (!coverImage) coverImage = images.find(i => i.ImagePurpose === 'BrandedKeyArt')?.Uri;
    if (!coverImage) coverImage = images.find(i => i.ImagePurpose === 'FeaturePromotionalSquareArt')?.Uri;
    if (!coverImage) coverImage = images.find(i => i.ImagePurpose === 'Logo')?.Uri;

    let backgroundImage = images.find(i => i.ImagePurpose === 'SuperHeroArt')?.Uri;
    if (!backgroundImage) backgroundImage = images.find(i => i.ImagePurpose === 'TitledHeroArt')?.Uri;

    return {
      title: props?.ProductTitle,
      developer: props?.DeveloperName,
      publisher: props?.PublisherName,
      description: props?.ProductDescription,
      coverImage: coverImage ? `https:${coverImage}` : undefined,
      backgroundImage: backgroundImage ? `https:${backgroundImage}` : undefined,
    };
  } catch (e) {
    return null;
  }
}

async function searchStoreArtByTitle(title) {
  try {
    const cleanTitle = title.replace(/[™®©]/g, '').trim();
    const url = `https://storeedgefd.dsx.mp.microsoft.com/v9.0/pages/searchResults?searchTerm=${encodeURIComponent(cleanTitle)}&market=US&locale=en-us&deviceFamily=windows.desktop`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();

    // Look for product IDs: 9[A-Z0-9]{11}
    const pids = [...new Set(text.match(/\b9[A-Z0-9]{11}\b/g) || [])];
    console.log(`PIDs found for "${cleanTitle}":`, pids.slice(0, 5));

    // Try each product ID until we find a match
    for (const pid of pids.slice(0, 5)) {
      const meta = await fetchStoreMetadataByStoreId(pid);
      if (meta && meta.coverImage) {
        console.log(`Matched PID ${pid} -> Title: "${meta.title}", Cover: ${meta.coverImage}`);
        return meta;
      }
    }
  } catch (e) {
    console.error('Search error:', e.message);
  }
  return null;
}

console.log('--- Test 1: By StoreId 9NZQPT0MWTD0 (Asphalt) ---');
const asphaltMeta = await fetchStoreMetadataByStoreId('9NZQPT0MWTD0');
console.log('Asphalt Meta:', asphaltMeta);

console.log('\n--- Test 2: By Title "Microsoft Solitaire Collection" ---');
const solMeta = await searchStoreArtByTitle('Microsoft Solitaire Collection');
console.log('Solitaire Meta:', solMeta);

console.log('\n--- Test 3: By Title "Solitaire & Casual Games" ---');
const solMeta2 = await searchStoreArtByTitle('Solitaire & Casual Games');
console.log('Solitaire 2 Meta:', solMeta2);

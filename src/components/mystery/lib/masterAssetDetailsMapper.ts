import { IMasterCharacter, IMasterLocation, IMasterWeapon } from '../../../types/game';

export function buildMasterAssetDetailState(type: string, item: any) {
  const fields = item?.data || item?.roles_json || {};
  if (type === 'character') {
    const character = item as IMasterCharacter;
    return {
      fields: {
        ...fields,
        dob: character.dob || fields.dob || '',
        age: character.age || fields.age || 0,
        hometown: character.hometown || fields.hometown || '',
        address: character.address || fields.address || '',
        ethnicity: character.ethnicity || fields.ethnicity || '',
        zodiac: character.zodiac || fields.zodiac || '',
        mbti: character.mbti || fields.mbti || '',
        height: character.height || fields.height || '',
        weight: character.weight || fields.weight || '',
        eye_color: character.eye_color || fields.eye_color || '',
        hair_color: character.hair_color || fields.hair_color || '',
        distinguishing_marks: character.distinguishing_marks || fields.distinguishing_marks || '',
        education: character.education || fields.education || '',
        criminal_record: character.criminal_record || fields.criminal_record || '',
        fav_color: character.fav_color || fields.fav_color || '',
        fav_snack: character.fav_snack || fields.fav_snack || '',
        fav_drink: character.fav_drink || fields.fav_drink || '',
        fav_music: character.fav_music || fields.fav_music || '',
        fav_hobby: character.fav_hobby || fields.fav_hobby || '',
        fav_pet: character.fav_pet || fields.fav_pet || '',
        aliases: Array.isArray(character.aliases_json) ? character.aliases_json : (fields.aliases || []),
        employment: Array.isArray(character.employment_json) ? character.employment_json : (fields.employment || []),
        rapport_likes: Array.isArray(character.rapport_likes_json) ? character.rapport_likes_json : (fields.rapport_likes || []),
        rapport_dislikes: Array.isArray(character.rapport_dislikes_json) ? character.rapport_dislikes_json : (fields.rapport_dislikes || []),
        rapport_quirks: Array.isArray(character.rapport_quirks_json) ? character.rapport_quirks_json : (fields.rapport_quirks || []),
        rapport_fun_facts: Array.isArray(character.rapport_fun_facts_json) ? character.rapport_fun_facts_json : (fields.rapport_fun_facts || []),
      },
      rapport: character.rapport_json || fields.rapport || { likes: [], dislikes: [], quirks: [], fun_facts: [] },
      favorites: character.favorites_json || fields.favorites || { color: '', snack: '', drink: '', music: '', hobby: '', pet: '' },
      data: null,
    };
  }

  if (type === 'location') {
    const location = item as IMasterLocation;
    return {
      fields: {
        ...fields,
        description: location.description || fields.description || '',
        location_id: location.location_id || fields.location_id || '',
        address_line1: location.address_line1 || fields.address_line1 || '',
        address_line2: location.address_line2 || fields.address_line2 || '',
        city: location.city || fields.city || '',
        region: location.region || fields.region || '',
        postal_code: location.postal_code || fields.postal_code || '',
        country: location.country || fields.country || '',
        base_image_prompt: location.base_image_prompt || fields.base_image_prompt || '',
        overlay_asset_prompt: location.overlay_asset_prompt || fields.overlay_asset_prompt || '',
        overlay_trigger: location.overlay_trigger || fields.overlay_trigger || '',
      },
      data: { description: location.description || fields.description || '', items: location.items || fields.items || [], image: location.image || fields.image || null },
      rapport: null,
      favorites: null,
    };
  }

  if (type === 'weapon') {
    const weapon = item as IMasterWeapon;
    return {
      fields: {
        ...fields,
        description: weapon.description || fields.description || '',
        fingerprints: Array.isArray(weapon.fingerprints) ? weapon.fingerprints : (fields.fingerprints || []),
      },
      data: { description: weapon.description || fields.description || '', items: weapon.items || fields.items || [], image: weapon.image || fields.image || null },
      rapport: null,
      favorites: null,
    };
  }

  return {
    fields,
    data: { description: item?.description || fields.description || '', items: item?.items || fields.items || [], image: item?.image || fields.image || null },
    rapport: null,
    favorites: null,
  };
}

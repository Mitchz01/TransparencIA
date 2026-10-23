import type { DocumentType, EntityNature, PersonType } from '../../../domain/account'

// Spec 020: the identification of whoever registers public projects, in the words of Colombian rules.

export const PERSON_TYPE_LABELS: Record<PersonType, string> = { natural: 'Persona natural', juridica: 'Persona jurídica' }

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  PPT: 'Permiso por protección temporal',
  PA: 'Pasaporte',
  NIT: 'NIT',
}

export const NATURE_LABELS: Record<EntityNature, string> = {
  publica: 'Entidad pública',
  privada: 'Empresa privada',
  esal: 'Entidad sin ánimo de lucro',
}

/** The authorization Ley 1581 de 2012 asks for: prior, express and informed, with its purpose. */
export const CONSENT_TEXT =
  'Autorizo a TransparencIA a tratar estos datos para identificarme como ejecutor de proyectos públicos y para publicar en el portal la información de los proyectos que registre, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013. Puedo consultarlos, corregirlos o retirar esta autorización cuando quiera.'

export const PROFILE_HINT = 'Son los datos que exige la contratación pública en Colombia. Puedes completarlos ahora o después, desde tu perfil.'

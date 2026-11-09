export type UserFacingErrorAction =
  | "auth"
  | "load"
  | "save"
  | "delete"
  | "scan"
  | "share"
  | "payment-status"
  | "signature";

const messages: Record<UserFacingErrorAction, string> = {
  auth: "Votre session n’a pas pu être vérifiée. Connectez-vous à nouveau.",
  load: "Impossible de charger ces informations. Réessayez dans quelques instants.",
  save: "L’enregistrement a échoué. Vérifiez votre connexion puis réessayez.",
  delete: "La suppression a échoué. Vérifiez votre connexion puis réessayez.",
  scan: "L’analyse du reçu a échoué. Réessayez avec une image lisible.",
  share: "La préparation du partage a échoué. Réessayez dans quelques instants.",
  "payment-status": "Le statut de paiement n’a pas pu être mis à jour. Réessayez.",
  signature: "La demande de signature n’a pas pu être chargée ou créée. Réessayez.",
};

export function userFacingError(action: UserFacingErrorAction): string {
  return messages[action];
}

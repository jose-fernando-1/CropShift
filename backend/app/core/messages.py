"""Localized, human-readable API error messages (the contract localizes them per Accept-Language).

Ids, codes and numbers are never localized. Keep the English text first; pt-BR mirrors it.
"""

from app.core.i18n import Locale

ERROR_MESSAGES: dict[str, dict[Locale, str]] = {
    "invalid_request": {
        "en": "Send lat/lon or municipality_code, plus optional soil_class (1-3) and regime.",
        "pt-BR": "Envie lat/lon ou municipality_code, e opcionalmente soil_class (1-3) e regime.",
    },
    "invalid_coordinates": {
        "en": "Latitude must be in [-90, 90] and longitude in [-180, 180].",
        "pt-BR": "A latitude deve estar em [-90, 90] e a longitude em [-180, 180].",
    },
    "point_not_covered": {
        "en": "This point is outside Pernambuco. Cropshift covers Pernambuco only.",
        "pt-BR": "Este ponto está fora de Pernambuco. O Cropshift cobre só Pernambuco.",
    },
    "municipality_not_covered": {
        "en": "This municipality is not covered. Cropshift covers Pernambuco only.",
        "pt-BR": "Este município não está coberto. O Cropshift cobre só Pernambuco.",
    },
    "no_data": {
        "en": "There is no precomputed climate data for this place yet.",
        "pt-BR": "Ainda não há dados climáticos pré-calculados para este local.",
    },
    "unknown_id": {"en": "Unknown analysis id.", "pt-BR": "Id de análise desconhecido."},
    "unknown_crop": {"en": "Unknown crop.", "pt-BR": "Cultura desconhecida."},
    "not_found": {
        "en": "The requested resource was not found.",
        "pt-BR": "O recurso solicitado não foi encontrado.",
    },
    "bad_request": {
        "en": "The request could not be processed.",
        "pt-BR": "A requisição não pôde ser processada.",
    },
    "rate_limited": {
        "en": "Too many requests. Wait a moment and try again.",
        "pt-BR": "Muitas requisições. Aguarde um instante e tente de novo.",
    },
    "database_unavailable": {"en": "Database unavailable.", "pt-BR": "Banco de dados indisponível."},
    "explain_failed": {"en": "The explanation service failed.", "pt-BR": "O serviço de explicação falhou."},
    "internal": {"en": "Unexpected server error.", "pt-BR": "Erro inesperado no servidor."},
}


def message(key: str, locale: Locale) -> str:
    return ERROR_MESSAGES[key][locale]

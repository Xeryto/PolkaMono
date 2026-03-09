import re

# Common character substitutions used to bypass filters
_SUBSTITUTIONS = {
    "0": "о",
    "@": "а",
    "3": "з",
    "1": "i",
    "$": "s",
    "!": "i",
}

# English profanity / hate / violence / NSFW
_EN_WORDS = frozenset({
    # slurs & hate
    "nigger", "nigga", "faggot", "fag", "retard", "retarded", "tranny",
    "kike", "spic", "chink", "wetback", "raghead", "gypsy", "cripple",
    # profanity
    "fuck", "fucker", "fucking", "motherfuck", "shit", "bullshit",
    "bitch", "asshole", "asshat", "bastard", "cunt", "dick", "cock",
    "pussy", "whore", "slut", "twat", "wanker", "prick",
    # violence
    "killer", "murder", "murderer", "rapist", "rape", "pedo", "pedophile",
    "abuse", "abuser", "bomb", "bomber", "explosive", "gunman", "shooting",
    "massacre", "cartel", "druglord",
    # terrorism / extremism
    "nazi", "nazism", "fascist", "fascism", "kkk", "terrorist", "terrorism",
    "extremist", "extremism", "dictator", "dictatorship", "propaganda",
    "isis", "alqaeda", "taliban", "gestapo", "kgb", "cia", "fbi",
    # political figures
    "hitler", "stalin", "putin", "trump", "biden",
    # NSFW
    "porn", "porno", "pornhub", "sex", "xxx", "hentai", "nude", "naked",
    "blowjob", "anal", "cum", "milf", "bdsm", "fetish", "incest",
    "onlyfans",
    # self-harm
    "suicide", "selfharm", "self-harm", "killmyself", "kms", "cutting",
})

# Russian profanity / hate / violence / NSFW
_RU_WORDS = frozenset({
    # мат (stems for substring matching)
    "хуй", "пизд", "еба", "ёба", "ебл", "ебан", "ебат",
    "бля", "бляд", "блядь", "блять", "сука", "сучк",
    "муд", "гандон", "пидор", "пидар", "шлюх", "жоп", "залуп",
    # insults
    "дурак", "идиот", "дебил", "тупой", "тварь", "мразь", "ублюдок",
    "сволочь", "урод", "чмо", "гнида", "ничтожество", "лох", "падаль",
    "скотина",
    # political figures
    "путин", "зеленский", "навальный", "гитлер", "сталин", "ленин",
    # organizations / extremism
    "ссср", "нсдап", "гестапо", "кгб", "фсб", "цру", "нато",
    "террор", "террорист", "экстремизм", "экстремист",
    "нацизм", "нацист", "фашизм", "фашист", "расизм", "расист",
    "сепаратизм", "революция", "диктатура", "пропаганда",
    # violence
    "убийца", "убийство", "насилие", "изнасил", "педофил", "педо",
    "маньяк", "казнь", "расстрел", "взрыв", "бомба", "оружие",
    # ethnic slurs
    "хач", "чурка", "негр", "ниггер", "узкоглаз", "жид", "черножоп",
    # ableism
    "инвалид", "даунизм",
    # drugs
    "наркотик", "наркота", "кокаин", "героин", "амфетамин",
    "метамфетамин", "торговец",
    # NSFW
    "секс", "порно", "эротик", "эротика", "минет", "анал",
    "трах", "трахать", "оргия", "фетиш", "инцест", "проститутка",
    "онлифанс",
})

_ALL_WORDS = _EN_WORDS | _RU_WORDS


def _normalize(text: str) -> str:
    """Lowercase and apply common character substitutions."""
    text = text.lower()
    for char, replacement in _SUBSTITUTIONS.items():
        text = text.replace(char, replacement)
    return text


def contains_profanity(text: str) -> bool:
    """Check if text contains profanity using substring matching."""
    normalized = _normalize(text)
    # Remove common separators used to break up words
    stripped = re.sub(r"[_\-.\s]", "", normalized)
    for word in _ALL_WORDS:
        if word in stripped:
            return True
    return False

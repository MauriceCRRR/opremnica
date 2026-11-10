// pot samo za eno vlogo, vsi drugi dobijo 403
export function samo(vloga) {
  return (req, res, next) => {
    if (req.uporabnik.vloga !== vloga) {
      return res.status(403).json({ napaka: 'Za to dejanje nimaš pravic' });
    }
    next();
  };
}

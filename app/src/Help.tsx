/** Écran « Comment jouer » : l'essentiel des règles et de l'interface. */
export function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Comment jouer">
      <main className="report help">
        <div className="row">
          <h1>Comment jouer</h1>
          <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <section className="card">
          <h2>Le but</h2>
          <p>Conquérir un maximum d'îles. À la fin du dernier tour, celui qui a le plus d'îles gagne. Prendre toutes les capitales fait gagner tout de suite.</p>
          <p className="muted">Un tour = un jour. Chacun donne ses ordres en secret ; à minuit, tout est résolu en même temps. Si tous les joueurs sont prêts avant, le tour est résolu aussitôt et le suivant commence (il se termine lui aussi à minuit).</p>
        </section>

        <section className="card">
          <h2>Lire la carte</h2>
          <p><span className="dot" style={{ background: '#e4572e' }} /> Rond de couleur : île d'un joueur. ♛ = capitale.</p>
          <p><span className="dot" style={{ background: '#6c9a5a' }} /> Rond vert : île vierge, gardée par des soldats.</p>
          <p><b>Chiffre</b> = soldats sur l'île · <b>🛡</b> = défense totale (soldats + 3 pour le mur d'une capitale + 3 pour une tour).</p>
          <p><span className="dot" style={{ background: '#8b5a2b' }} /> symbole bois · <span className="dot" style={{ background: '#ffd23f' }} /> symbole or</p>
          <p>Bâtiments : ⛏️ mine · 🪓 scierie · ⛺ baraque · ⚓ port · 🏰 tour · 🎓 université (en transparence : en construction ce tour).</p>
          <p>Sur tes îles, le chiffre au centre est le nombre de soldats présents maintenant ; la petite bulle <b>→1</b> indique combien il en restera après tes ordres (recrues comprises, départs déduits). Sur une flèche (courbée quand elle contourne une île) : <b>⚔3</b> = attaque avec 3 soldats, <b style={{ color: 'var(--accent)' }}>+2M</b> (en or) = et 2 mercenaires (ils disparaissent après l'attaque).</p>
        </section>

        <section className="card">
          <h2>Brouillard</h2>
          <p>Tu ne vois que les îles proches des tiennes. À 1 case : tout (soldats, défense, bâtiments). À 2 cases : l'île, son propriétaire et ses symboles, mais pas sa défense (<b>?</b>). Au-delà : seulement à qui est chaque île (neutre ou couleur d'un joueur), en grisé.</p>
          <p><b>Espion</b> : pour 1 or, envoie un espion sur une île de ton choix (une par tour). Le lendemain matin, tu connais ses soldats, sa défense et ses bâtiments.</p>
          <p className="muted">Les ressources des autres joueurs sont secrètes, et le rapport de la nuit ne montre que les batailles que tu as pu voir. Toute la carte est révélée à la fin de la partie.</p>
        </section>

        <section className="card">
          <h2>Ton tour, étape par étape</h2>
          <ol>
            <li>Touche une de tes îles.</li>
            <li><b>Recruter</b> des soldats (1 or + 1 bois chacun) ou <b>construire</b> un bâtiment.</li>
            <li><b>Envoyer des troupes</b> : les cibles clignotent (rouge = attaque, vert = déplacement vers une de tes îles).</li>
            <li>Vérifie la liste dans <b>Mes ordres</b>, puis <b>Je suis prêt ✓</b>. Tu peux encore les modifier et revalider jusqu'à la résolution.</li>
          </ol>
        </section>

        <section className="card">
          <h2>Ressources</h2>
          <p>Île normale : 1 or + 1 bois par tour. Symbole bois : 3 bois. Symbole or : 3 or. Capitale : 3 + 3.</p>
          <p className="muted">Une île conquise ne rapporte rien le tour de sa conquête : elle produit à partir du tour suivant.</p>
          <p>En haut à gauche de la carte, le <b>bilan du tour</b> se met à jour à chaque ordre : stock actuel, dépenses des ordres, revenus prévus et solde <b>après</b> le tour. Les revenus sont théoriques : ils supposent que personne ne te prend d'île cette nuit. Touche le bilan pour le replier.</p>
          <p>Au-delà de 6 îles, les revenus baissent : chaque île en plus retire 10 % (à 10 îles, tu touches 1 / 1,4 ≈ 71 % de tes revenus). Les îles comptent toujours pour la victoire.</p>
          <table className="help-table">
            <tbody>
              <tr><td>Mine</td><td>3 bois</td><td>+2 or / tour</td></tr>
              <tr><td>Scierie</td><td>2 or</td><td>+2 bois / tour</td></tr>
              <tr><td>Baraque</td><td>4 bois</td><td>+1 soldat / tour</td></tr>
              <tr><td>Port</td><td>3 bois</td><td>portée 2 gratuite</td></tr>
              <tr><td>Tour</td><td>3 bois</td><td>+3 défense</td></tr>
              <tr><td>Université</td><td>5 bois</td><td>bientôt</td></tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Combat</h2>
          <p><b>Soldat</b> : force 1, reste sur l'île conquise. <b>Mercenaire</b> : 2 or, force 3, disparaît après l'attaque.</p>
          <p>Pas plus de mercenaires que de soldats dans une attaque. Pour prendre l'île, il faut qu'au moins un soldat survive pour l'occuper : sinon les défenseurs sont tués mais l'île ne change pas de main.</p>
          <p>Défense = soldats + 3 pour le mur d'une capitale + 3 pour une tour.</p>
          <p>Il faut être <b>strictement plus fort</b>. Le vainqueur perd autant de force que la défense (1 de moins s'il avait le double). Une attaque ratée : tous les attaquants meurent.</p>
          <p className="muted">Exemple : 6 soldats contre une défense de 4 → victoire, il reste 2 soldats sur l'île.</p>
          <p>Portée 1 : îles voisines. Portée 2 : +1 or par unité, gratuit avec un port.</p>
          <p className="muted">Si deux joueurs attaquent la même île la même nuit, leurs forces s'additionnent en partie ; le plus fort prend l'île. S'ils sont à égalité, l'attaque échoue et l'île reste à son propriétaire.</p>
        </section>

        <section className="card">
          <h2>Capitales et fin de partie</h2>
          <p>Une capitale prise perd son mur et son statut ; son ancien propriétaire continue de jouer tant qu'il a une île. Celui qui possède toutes les capitales de départ gagne aussitôt.</p>
          <p>Toutes les batailles d'une nuit ont lieu en même temps : des soldats partis attaquer ne défendent plus leur île.</p>
          <p>🏳️ <b>Se rendre</b> (dans le rapport du tour) : tes îles redeviennent vierges avec leurs soldats et leurs bâtiments, et tu deviens spectateur.</p>
        </section>

        <button className="primary wide" onClick={onClose}>C'est parti !</button>
      </main>
    </div>
  );
}

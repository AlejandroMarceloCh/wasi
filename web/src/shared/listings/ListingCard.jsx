import { ZONE_VARIANT, apartmentPhoto, onKeyActivate, safeImageUrl } from '../lib/helpers.js';
import { Icon } from '../ui/components.jsx';

export const ListingCard = ({ listing, onOpen, isFav, onToggleFav }) => {
  const z = listing.zone;
  const open = () => onOpen && onOpen(listing.id);
  const price = Math.round(listing.price_usd).toLocaleString('en-US');
  const priceUnit = listing.operacion === 'venta' ? ' total' : ' /mes';
  const specs = listing.es_estudio ? 'Estudio' : `${listing.dormitorios} dorm`;
  const imgSrc = safeImageUrl(listing.image_url)
    || (listing.id != null ? apartmentPhoto(listing.id) : null);

  const showFav = typeof onToggleFav === 'function';
  const toggleFav = (e) => {
    e.stopPropagation();
    onToggleFav(listing.id, !isFav);
  };

  return (
    <div className="listing-card-z card hover" role="button" tabIndex={0}
         onClick={open} onKeyDown={onKeyActivate(open)}>
      <div className="lcz-media">
        <div className={`lcz-placeholder lcz-ph-${ZONE_VARIANT[z] || 'default'}`}>
          <Icon name="home" size={28} stroke="#fff"/>
        </div>
        {imgSrc && <img src={imgSrc} alt={listing.address} loading="lazy"
               onError={(e)=>{ e.target.style.display='none'; }}/>}
        {z && <span className={`lcz-verdict tag tag-${ZONE_VARIANT[z] || 'default'}`}>{z}</span>}
        {showFav && (
          <button
            type="button"
            className={`lcz-fav ${isFav ? 'on' : ''}`}
            aria-pressed={isFav}
            aria-label={isFav ? 'Quitar de guardados' : 'Guardar inmueble'}
            title={isFav ? 'Quitar de guardados' : 'Guardar inmueble'}
            onClick={toggleFav}
          >
            <Icon name="heart" size={17} fill={isFav ? 'currentColor' : 'none'}/>
          </button>
        )}
      </div>
      <div className="lcz-body">
        <div className="lcz-price numeric">
          ${price}<span className="lcz-per">{priceUnit}</span>
        </div>
        <div className="lcz-addr">{listing.address}</div>
        <div className="lcz-dist small muted">{listing.district}</div>
        <div className="lcz-specs tiny muted">
          {specs} · {listing.banos} {listing.banos === 1 ? 'baño' : 'baños'} · {Math.round(listing.area_m2)} m²
        </div>
      </div>
    </div>
  );
};

import GuildShop from '@/components/guild/shop/GuildShop';

const Shop = ({ userId }) => (
  <div className="p-4 md:p-8">
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">Loja da Guilda</h1>
      <p className="text-gray-400 text-sm mt-1">
        Troque seus pontos por recompensas — I V E N U M I
      </p>
    </div>
    <GuildShop userId={userId} />
  </div>
);

export default Shop;

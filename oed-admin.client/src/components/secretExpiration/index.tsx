import React from 'react';

interface SecretExpirationProps {
  expirationDate: Date;
  onExtend?: () => void;
}

const SecretExpiration: React.FC<SecretExpirationProps> = ({ expirationDate, onExtend }) => {
  const now = new Date();
  const isExpired = expirationDate <= now;

  return (
    <div className="secret-expiration">
      <p>
        Secret expires on: <strong>{expirationDate.toLocaleString()}</strong>
      </p>
      {isExpired ? (
        <span style={{ color: 'red' }}>Expired</span>
      ) : (
        <span style={{ color: 'green' }}>Active</span>
      )}
      {onExtend && (
        <button onClick={onExtend} disabled={isExpired}>
          Extend Expiration
        </button>
      )}
    </div>
  );
};

export default SecretExpiration;
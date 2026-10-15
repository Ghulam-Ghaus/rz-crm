import React, { useState, useRef, useEffect } from 'react';
import { ProductListItem } from '@bakery/contracts';

interface GrnItemSearchPickerProps {
  products: ProductListItem[];
  selectedVariantId: number;
  onSelect: (variantId: number, product: ProductListItem | null) => void;
  disabled?: boolean;
  onCreateNewProduct?: (query: string) => void;
  placeholder?: string;
}

export const GrnItemSearchPicker: React.FC<GrnItemSearchPickerProps> = ({
  products,
  selectedVariantId,
  onSelect,
  disabled = false,
  onCreateNewProduct,
  placeholder = '🔍 Scan barcode or type item name / SKU...',
}) => {
  const selectedProduct = products.find((p) => p.variantId === selectedVariantId);
  const [isOpen, setIsOpen] = useState(false);
  const [typedQuery, setTypedQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setTypedQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products: if user is typing, filter by typed text; otherwise show all products
  const query = typedQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    if (!query) return true;
    const nameMatch = p.name.toLowerCase().includes(query);
    const skuMatch = p.sku.toLowerCase().includes(query);
    const catMatch = p.categoryName ? p.categoryName.toLowerCase().includes(query) : false;
    const barMatch = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
    return nameMatch || skuMatch || catMatch || barMatch;
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = typedQuery.trim();
      if (!clean) return;

      const cleanLower = clean.toLowerCase();

      // 1. Exact barcode match
      const exactBarcode = products.find(
        (p) => p.barcode && p.barcode.trim().toLowerCase() === cleanLower
      );
      if (exactBarcode) {
        onSelect(exactBarcode.variantId, exactBarcode);
        setTypedQuery('');
        setIsOpen(false);
        return;
      }

      // 2. Exact SKU match
      const exactSku = products.find(
        (p) => p.sku && p.sku.trim().toLowerCase() === cleanLower
      );
      if (exactSku) {
        onSelect(exactSku.variantId, exactSku);
        setTypedQuery('');
        setIsOpen(false);
        return;
      }

      // 3. Exactly 1 matching product in filtered list
      if (filteredProducts.length === 1) {
        const item = filteredProducts[0];
        onSelect(item.variantId, item);
        setTypedQuery('');
        setIsOpen(false);
        return;
      }

      // 4. No matching product found - trigger quick creation modal!
      if (filteredProducts.length === 0 && onCreateNewProduct) {
        onCreateNewProduct(clean);
        setIsOpen(false);
        return;
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const displayText = isOpen
    ? typedQuery
    : selectedProduct
    ? `${selectedProduct.name} (${selectedProduct.sku})${selectedProduct.barcode ? ` [${selectedProduct.barcode}]` : ''}`
    : '';

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          className="form-input"
          style={{
            padding: '5px 46px 5px 8px',
            fontSize: '12px',
            width: '100%',
            borderColor: isOpen ? '#2563eb' : '#cbd5e1',
            boxShadow: isOpen ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none',
            fontWeight: selectedProduct && !isOpen ? 600 : 400,
            background: '#ffffff',
          }}
          placeholder={placeholder}
          value={displayText}
          disabled={disabled}
          onFocus={() => {
            setIsOpen(true);
            setTypedQuery('');
          }}
          onClick={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            setTypedQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value.trim() && selectedVariantId) {
              onSelect(0, null);
            }
          }}
        />

        <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '2px' }}>
          {selectedProduct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(0, null);
                setTypedQuery('');
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 4px',
                lineHeight: 1,
              }}
              title="Clear item selection"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              setTypedQuery('');
              if (!isOpen) inputRef.current?.focus();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '2px 4px',
              lineHeight: 1,
            }}
            title="Browse all items"
          >
            {isOpen ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Floating Dropdown List of All Items */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: '350px',
            maxHeight: '260px',
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2), 0 4px 10px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
          }}
        >
          <div style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Showing {filteredProducts.length} product(s)</span>
            {query && <span>Filter: &ldquo;{query}&rdquo;</span>}
          </div>

          {filteredProducts.length === 0 ? (
            <div style={{ padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                No product found matching &ldquo;{typedQuery}&rdquo;
              </div>
              {onCreateNewProduct && typedQuery.trim() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNewProduct(typedQuery.trim());
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <span>➕</span> Add &ldquo;{typedQuery.trim()}&rdquo; as New Product
                </button>
              )}
            </div>
          ) : (
            <>
              {filteredProducts.map((p) => {
                const isSelected = p.variantId === selectedVariantId;
                const buyCostRs = ((p.costMinorUnits || 0) / 100).toFixed(2);
                const retailPriceRs = ((p.priceMinorUnits || 0) / 100).toFixed(2);
                return (
                  <div
                    key={p.variantId}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p.variantId, p);
                      setTypedQuery('');
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'background-color 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginTop: '2px', fontSize: '11px', color: '#64748b' }}>
                        <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }}>
                          {p.sku}
                        </span>
                        {p.barcode && (
                          <span style={{ fontFamily: 'monospace', background: '#e0f2fe', color: '#0369a1', padding: '1px 4px', borderRadius: '4px', fontSize: '10px' }}>
                            🏷️ {p.barcode}
                          </span>
                        )}
                        {p.categoryName && (
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                            {p.categoryName}
                          </span>
                        )}
                        <span>[{p.baseUnitCode}]</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '11px' }}>
                      <div style={{ color: '#059669', fontWeight: 700 }}>
                        Cost: Rs. {buyCostRs}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '10px' }}>
                        Sell: Rs. {retailPriceRs}
                      </div>
                    </div>
                  </div>
                );
              })}
              {onCreateNewProduct && typedQuery.trim() && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#f0fdf4',
                    borderTop: '1px dashed #86efac',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#15803d',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNewProduct(typedQuery.trim());
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dcfce7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                >
                  ✨ Can&apos;t find item? <b>+ Add &ldquo;{typedQuery.trim()}&rdquo; as New Product</b>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

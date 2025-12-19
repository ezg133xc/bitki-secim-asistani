import React, { useState, useEffect } from "react";
import type {
  RecommendationRequest,
  PlantRecommendation,
  AIRecommendationRequest,
  AIRecommendationResponse,
} from "./types";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

const initialForm: RecommendationRequest = {
  city: "",
  country: "",
  sun_exposure: "full_sun",
  soil_type: "well_drained",
  watering_preference: "medium",
  maintenance_preference: "low",
  wind_exposure: "exposed",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#334155",
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  marginTop: "0.2rem",
  padding: "0.4rem 0.6rem",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "#f8fafc",
};

type LatLngTuple = [number, number];

const defaultCenter: LatLngTuple = [39, 35];

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationClickMarker({
  position,
  onChange,
}: {
  position: LatLngTuple | null;
  onChange: (pos: LatLngTuple) => void;
}) {
  const map = useMapEvents({
    click(e: L.LeafletMouseEvent) {
      const newPos: LatLngTuple = [e.latlng.lat, e.latlng.lng];
      onChange(newPos);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position ? <Marker position={position} icon={markerIcon} /> : null;
}


async function fetchRecommendations(payload: RecommendationRequest) {
  const res = await fetch("/api/v1/plants/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("API error");
  }
  return (await res.json()) as { results: PlantRecommendation[] };
}

async function fetchAIRecommendation(
  payload: AIRecommendationRequest
): Promise<AIRecommendationResponse> {
  const res = await fetch("/api/v1/plants/ai-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("AI API error");
  }
  return (await res.json()) as AIRecommendationResponse;
}

function App() {
  const [form, setForm] = useState<RecommendationRequest>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlantRecommendation[]>([]);
  const [selectedPosition, setSelectedPosition] =
    useState<LatLngTuple | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIRecommendationResponse | null>(
    null
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev: RecommendationRequest) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const data = await fetchRecommendations(form);
      setResults(data.results);
    } catch (err) {
      setError("Öneriler alınırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleAIRecommendation = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const aiPayload: AIRecommendationRequest = {
        ...form,
        top_n: 5,
        language: "tr",
      };
      console.log("🤖 AI'ya gönderilen payload:", aiPayload);
      
      const data = await fetchAIRecommendation(aiPayload);
      
      console.log("🤖 AI'dan gelen tam yanıt:", data);
      console.log("📊 Rule-based sonuçlar:", data.rule_based_results);
      console.log("⭐ AI seçimi:", data.ai_best);
      
      setAiResult(data);
      setResults(data.rule_based_results);
    } catch (err) {
      console.error("❌ AI hatası:", err);
      setAiError("AI önerisi alınamadı. Lütfen tekrar deneyin.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPosition) return;

    const [lat, lon] = selectedPosition;
    setLocationLoading(true);
    setLocationError(null);

    const controller = new AbortController();

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((data) => {
        const address = data.address || {};
        const province =
          address.state ||
          address.city ||
          address.province ||
          address.region ||
          "";
        const country = address.country || "";

        if (!province && !country) {
          setLocationError(
            "Could not detect city from this point, please type it manually."
          );
          return;
        }

        // Only update city and country, keep other form fields as user set them
        setForm((prev) => ({
          ...prev,
          city: province || prev.city,
          country: country || prev.country,
        }));

        // Auto-fetch recommendations after updating location
        setTimeout(() => {
          const updatedForm = {
            ...form,
            city: province || form.city,
            country: country || form.country,
          };
          
          // Trigger recommendation fetch
          setLoading(true);
          setError(null);
          setAiResult(null);
          fetchRecommendations(updatedForm)
            .then((data) => {
              setResults(data.results);
            })
            .catch(() => {
              setError("Öneriler alınırken bir hata oluştu.");
            })
            .finally(() => {
              setLoading(false);
            });
        }, 100);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setLocationError(
          "Could not reach location service. Please type city manually."
        );
      })
      .finally(() => {
        setLocationLoading(false);
      });

    return () => controller.abort();
  }, [selectedPosition]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0f172a0d",
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: "2rem 1.5rem 3rem",
        }}
      >
        <header style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.15rem 0.6rem",
              borderRadius: 999,
              backgroundColor: "#e0f2fe",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "#0369a1",
              marginBottom: "0.75rem",
            }}
          >
            Kural tabanlı · Açıklanabilir · Açık kaynak
          </div>
          <h1 style={{ fontSize: "1.9rem", margin: 0, color: "#0f172a" }}>
            Bitki Seçim Asistanı
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              maxWidth: 640,
              color: "#475569",
              lineHeight: 1.5,
            }}
          >
            Alan koşullarınızı girin ve her bitki adayı için şeffaf, bilimsel temelli
            uygunluk skorları alın.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.2fr)",
            gap: "1.5rem",
            alignItems: "flex-start",
          }}
        >
          <section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "1.5rem",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: "0.75rem",
                fontSize: "1.1rem",
                color: "#0f172a",
              }}
            >
              Alan koşulları
            </h2>
            <p
              style={{
                marginTop: 0,
                marginBottom: "1.25rem",
                fontSize: "0.9rem",
                color: "#64748b",
              }}
            >
              Konum, ışık, toprak ve bakım beklentilerinizi tanımlayın. Puanlama
              motoru her bitki için bir uygunluk skoru hesaplayacak.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.9rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <label style={labelStyle}>
                  Şehir
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                    placeholder="örn. İzmir"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Ülke
                  <input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                    placeholder="örn. Türkiye"
                    style={inputStyle}
                  />
                </label>
              </div>

              <div style={{ marginTop: "0.25rem" }}>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    marginBottom: "0.4rem",
                  }}
                >
                  Veya haritadan bir konum seçerek şehir ve ülkeyi otomatik
                  doldurun (OpenStreetMap kullanılır).
                </p>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <MapContainer
                    center={defaultCenter}
                    zoom={5}
                    style={{ height: 260, width: "100%" }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationClickMarker
                      position={selectedPosition}
                      onChange={setSelectedPosition}
                    />
                  </MapContainer>
                </div>
                {locationLoading && (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#64748b",
                      marginTop: "0.35rem",
                    }}
                  >
                    Harita noktasından şehir ve ülke algılanıyor...
                  </p>
                )}
                {loading && selectedPosition && (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#16a34a",
                      marginTop: "0.35rem",
                      fontWeight: 500,
                    }}
                  >
                    🌱 Konum için öneriler hazırlanıyor...
                  </p>
                )}
                {locationError && (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#b91c1c",
                      marginTop: "0.35rem",
                    }}
                  >
                    {locationError}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <label style={labelStyle}>
                  Güneş durumu
                  <select
                    name="sun_exposure"
                    value={form.sun_exposure}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="full_sun">Tam güneş</option>
                    <option value="partial_shade">Yarı gölge</option>
                    <option value="shade">Gölge</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Toprak türü
                  <select
                    name="soil_type"
                    value={form.soil_type}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="clay">Killi</option>
                    <option value="sandy">Kumlu</option>
                    <option value="loam">Tınlı</option>
                    <option value="well_drained">İyi drene</option>
                    <option value="organic">Organik</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <label style={labelStyle}>
                  Sulama tercihi
                  <select
                    name="watering_preference"
                    value={form.watering_preference}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="low">Az</option>
                    <option value="medium">Orta</option>
                    <option value="high">Sık</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Bakım tercihi
                  <select
                    name="maintenance_preference"
                    value={form.maintenance_preference}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                  </select>
                </label>
              </div>

              <label style={labelStyle}>
                Rüzgar durumu
                <select
                  name="wind_exposure"
                  value={form.wind_exposure}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="exposed">Açık alan</option>
                  <option value="sheltered">Korunaklı</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.6rem 1.2rem",
                  borderRadius: 999,
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: loading ? "default" : "pointer",
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  color: "#ffffff",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Öneriler hesaplanıyor..." : "Önerileri getir"}
              </button>

              <button
                type="button"
                onClick={handleAIRecommendation}
                disabled={aiLoading || !form.city || !form.country}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.6rem 1.2rem",
                  borderRadius: 999,
                  border: "1px solid #6366f1",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor:
                    aiLoading || !form.city || !form.country
                      ? "default"
                      : "pointer",
                  background:
                    aiLoading || !form.city || !form.country
                      ? "#e0e7ff"
                      : "linear-gradient(135deg, #6366f1, #818cf8)",
                  color: "#ffffff",
                  opacity:
                    aiLoading || !form.city || !form.country ? 0.6 : 1,
                }}
              >
                {aiLoading ? "AI düşünüyor..." : "🤖 AI önerisi al"}
              </button>

              {error && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.85rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {error}
                </p>
              )}
              {aiError && (
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.85rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {aiError}
                </p>
              )}
            </form>
          </section>

          <section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "1.5rem",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              minHeight: "260px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "0.75rem",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.05rem",
                    color: "#0f172a",
                  }}
                >
                  Öneriler
                </h2>
                <p
                  style={{
                    margin: 0,
                    marginTop: "0.25rem",
                    fontSize: "0.85rem",
                    color: "#64748b",
                  }}
                >
                  Bitkiler puanlama kurallarına göre en uygundan en az uygun olana doğru sıralanmıştır.
                </p>
              </div>
              {results.length > 0 && (
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                  }}
                >
                  {results.length} bitki bulundu
                </span>
              )}
            </div>

            {aiResult && aiResult.ai_best && (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "1rem",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #eef2ff, #e0e7ff)",
                  border: "2px solid #6366f1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>🤖</span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#4338ca",
                    }}
                  >
                    AI Uzman Önerisi
                  </h3>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "#1e1b4b",
                    }}
                  >
                    En İyi Seçim:
                  </span>
                  <span
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "#4338ca",
                    }}
                  >
                    {(() => {
                      const chosen = results.find(
                        (p) => p.plant_id === aiResult.ai_best?.plant_id
                      );
                      return chosen
                        ? `${chosen.name_tr} (${chosen.name_latin})`
                        : "Bilinmeyen bitki";
                    })()}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    color: "#312e81",
                  }}
                >
                  {aiResult.ai_best.reasoning}
                </p>
              </div>
            )}

            {results.length === 0 ? (
              <p
                style={{
                  marginTop: "1rem",
                  fontSize: "0.9rem",
                  color: "#94a3b8",
                }}
              >
                Soldaki koşulları doldurun ve önerilen bitkileri uygunluk skorlarıyla birlikte görmek için <strong>Önerileri getir</strong> butonuna tıklayın.
              </p>
            ) : (
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.9rem" }}>
                {results.map((plant) => {
                  const status = plant.suitability_status;
                  const bgColor =
                    status === "Çok Uygun"
                      ? "#dcfce7"
                      : status === "Uygun"
                      ? "#e0f2fe"
                      : "#fee2e2";
                  const textColor =
                    status === "Çok Uygun"
                      ? "#166534"
                      : status === "Uygun"
                      ? "#075985"
                      : "#b91c1c";

                  return (
                    <div
                      key={plant.plant_id}
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(148, 163, 184, 0.5)",
                        padding: "1rem 1.1rem",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "1rem",
                              color: "#0f172a",
                            }}
                          >
                            {plant.name_tr}
                          </h3>
                          <p
                            style={{
                              margin: 0,
                              marginTop: "0.15rem",
                              fontSize: "0.8rem",
                              color: "#64748b",
                              fontStyle: "italic",
                            }}
                          >
                            {plant.name_latin}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              padding: "0.15rem 0.55rem",
                              borderRadius: 999,
                              backgroundColor: bgColor,
                              color: textColor,
                              fontSize: "0.75rem",
                              fontWeight: 600,
                            }}
                          >
                            {status}
                          </span>
                          <div
                            style={{
                              marginTop: "0.25rem",
                              fontSize: "0.8rem",
                              color: "#475569",
                            }}
                          >
                            Score: <strong>{plant.total_score}</strong>
                          </div>
                        </div>
                      </div>

                      <p
                        style={{
                          marginTop: "0.6rem",
                          marginBottom: "0.4rem",
                          fontSize: "0.85rem",
                          color: "#475569",
                        }}
                      >
                        {plant.maintenance_summary}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "0.35rem",
                          fontSize: "0.75rem",
                          color: "#64748b",
                        }}
                      >
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Cost: {plant.cost_level}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Sun: {plant.breakdown.sun}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Soil: {plant.breakdown.soil}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Water: {plant.breakdown.water}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Maint.: {plant.breakdown.maintenance}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Wind: {plant.breakdown.wind}
                        </span>
                        <span
                          style={{
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            backgroundColor: "#e5e7eb",
                          }}
                        >
                          Climate: {plant.breakdown.climate}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;

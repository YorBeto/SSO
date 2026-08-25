/**
 * Lee un secreto JWT del entorno sin fallback vacío. Si falta, se falla
 * rápido al usarlo en vez de firmar/verificar tokens con un secreto vacío
 * (equivalente a "sin firma": trivialmente falsificable).
 */
export function getJwtSecret(envVar: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const secret = process.env[envVar];
  if (!secret) {
    throw new Error(
      `${envVar} no está definido en el entorno. La aplicación no puede firmar/verificar tokens sin él.`,
    );
  }
  return secret;
}

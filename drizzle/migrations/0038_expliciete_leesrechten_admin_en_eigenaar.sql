-- ai_cache: uitsluitend service-role; beheerders mogen lezen
GRANT ALL ON public.ai_cache TO service_role;
CREATE POLICY "ai_cache_admin_select" ON public.ai_cache
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- app_errors: eigenaar en beheerder mogen eigen fouten lezen
GRANT SELECT ON public.app_errors TO authenticated;
CREATE POLICY "app_errors_eigen_of_admin_select" ON public.app_errors
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- daily_platform_stats: alleen beheerders
GRANT SELECT ON public.daily_platform_stats TO authenticated;
GRANT ALL ON public.daily_platform_stats TO service_role;
CREATE POLICY "daily_platform_stats_admin_select" ON public.daily_platform_stats
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- daily_user_stats: eigen rijen of beheerder
GRANT SELECT ON public.daily_user_stats TO authenticated;
GRANT ALL ON public.daily_user_stats TO service_role;
CREATE POLICY "daily_user_stats_eigen_of_admin_select" ON public.daily_user_stats
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- loyalty_scan_events: eigen scanhistoriek of beheerder
GRANT SELECT ON public.loyalty_scan_events TO authenticated;
CREATE POLICY "loyalty_scan_events_eigen_of_admin_select" ON public.loyalty_scan_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- model_prices: alleen beheerders mogen prijzen lezen
GRANT SELECT ON public.model_prices TO authenticated;
GRANT ALL ON public.model_prices TO service_role;
CREATE POLICY "model_prices_admin_select" ON public.model_prices
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- loyalty_cards: 'gedeeld' kan enkel door de eigenaar gewijzigd worden
DROP POLICY IF EXISTS "loyalty_cards_groep" ON public.loyalty_cards;
CREATE POLICY "loyalty_cards_groep" ON public.loyalty_cards
  FOR SELECT TO authenticated
  USING (gedeeld AND public.samen_in_groep(user_id, auth.uid()));

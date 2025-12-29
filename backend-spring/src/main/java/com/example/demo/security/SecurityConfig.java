package com.example.demo.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import jakarta.servlet.http.HttpServletRequest;


@Configuration
@EnableWebSecurity
public class SecurityConfig {

	private final OAuth2SuccessHandler oAuth2SuccessHandler;

	public SecurityConfig(OAuth2SuccessHandler oAuth2SuccessHandler) {
	    this.oAuth2SuccessHandler = oAuth2SuccessHandler;
	}
	
	@Bean
	CorsConfigurationSource corsConfigurationSource() {
	    return (HttpServletRequest request) -> {
	        CorsConfiguration config = new CorsConfiguration();
	        config.setAllowedOrigins(List.of("http://localhost:5173"));
	        config.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
	        config.setAllowedHeaders(List.of("*"));
	        config.setAllowCredentials(true); // 쿠키 허용 핵심
	        return config;
	    };
	}
	
	
	@Bean
	SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
		
		return http.csrf(csrf -> csrf.disable())
				.cors(cors -> cors.configurationSource(corsConfigurationSource()))
				.sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/api/health").permitAll()
						.requestMatchers("/api/members/join", "/api/members/login").permitAll()
						.requestMatchers("/api/members/me").permitAll()
						.requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/boards/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/auth/token").permitAll()
						.anyRequest().authenticated()
				).addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
				.oauth2Login(o -> o.successHandler(oAuth2SuccessHandler))
				.build();
	}
	
}

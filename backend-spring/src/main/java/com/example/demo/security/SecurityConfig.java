package com.example.demo.security;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
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
      config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
      config.setAllowedHeaders(List.of("*"));
      config.setAllowCredentials(true);
      return config;
    };
  }

  // API 체인: /api/** 는 절대 /login으로 리다이렉트하지 말고 401로
  @Bean
  @Order(1)
  SecurityFilterChain apiChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
    http
      .securityMatcher("/api/**")
      .csrf(csrf -> csrf.disable())
      .cors(cors -> cors.configurationSource(corsConfigurationSource()))
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .formLogin(form -> form.disable())
      .httpBasic(basic -> basic.disable())
      .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
      .authorizeHttpRequests(auth -> auth
    	.requestMatchers("/",  "/error", "/oauth2/success", "/oauth2/**", "/login/**", "/login/oauth2/**").permitAll()
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .requestMatchers("/api/health").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/countries").permitAll()
        .requestMatchers("/api/members/join").permitAll()
        .requestMatchers("/api/members/login").permitAll()
        .requestMatchers("/api/auth/**").permitAll()
        .requestMatchers(HttpMethod.POST, "/api/auth/token").permitAll()

        .requestMatchers(HttpMethod.GET, "/api/boards/**").permitAll()

        // ⚠여기 임시는 원하는 대로 (인증 붙일 거면 permitAll 말고 authenticated로)
        .requestMatchers(HttpMethod.PUT, "/api/boards/**").permitAll()
        .requestMatchers(HttpMethod.PATCH, "/api/boards/**").permitAll()

        .anyRequest().authenticated()
      )
      .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

    return http.build();
  }

  // OAuth2 로그인용 체인: /oauth2/** 등만 처리
  @Bean
  @Order(2)
  SecurityFilterChain oauth2Chain(HttpSecurity http) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .cors(cors -> cors.configurationSource(corsConfigurationSource()))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/oauth2/**", "/login/oauth2/**", "/login**").permitAll()
        .anyRequest().permitAll()
      )
      .oauth2Login(oauth -> oauth
              .successHandler((req, res, auth) -> {
                  // 로그인 성공 후 프론트로 이동
                  res.sendRedirect("http://localhost:5173/oauth2/success");
              })
          );

      return http.build();
  }
}

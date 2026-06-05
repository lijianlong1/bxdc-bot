package com.lobsterai.skillgateway.config;

import com.lobsterai.skillgateway.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * 安全配置类。
 * <p>
 * 配置 Spring Security 过滤器链，定义 API 的访问权限。
 * 仅允许持有有效 Token 的请求访问 Skill 接口。
 * </p>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    /**
     * 配置安全过滤器链。
     *
     * @param http HttpSecurity 对象
     * @return 构建好的 SecurityFilterChain
     * @throws Exception 配置异常
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .authorizeRequests(auth -> auth
                .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .antMatchers(HttpMethod.GET, "/api/skills", "/api/skills/*").permitAll()
                .antMatchers(HttpMethod.GET, "/api/skills/async-tasks/*/wait").permitAll()
                .antMatchers(HttpMethod.GET, "/api/skills/text-prompts", "/api/skills/text-prompts/**").permitAll()
                .antMatchers(HttpMethod.POST, "/api/skills/enum-source").permitAll()
                .antMatchers(HttpMethod.GET, "/api/system-skills/**").permitAll()
                .antMatchers("/api/skills/**").authenticated()
                .antMatchers("/api/system-skills/**").authenticated()
                .anyRequest().permitAll()
            )
            .addFilterBefore(new ApiTokenFilter(), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .collect(Collectors.toList());
        configuration.setAllowedOriginPatterns(origins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * 自定义 API Token 认证过滤器。
     * <p>
     * 从请求头中提取 Token 并进行校验。
     * </p>
     */
    public static class ApiTokenFilter extends OncePerRequestFilter {
        private static final String API_KEY_HEADER = "X-Agent-Token";
        private static final String DEFAULT_TOKEN = "your-secure-token-here";

        private String getValidToken() {
            String envToken = System.getenv("JAVA_GATEWAY_TOKEN");
            if (envToken != null && !StringUtils.isBlank(envToken)) {
                return envToken;
            }
            return DEFAULT_TOKEN;
        }

        /**
         * 执行过滤逻辑。
         *
         * @param request     HTTP 请求
         * @param response    HTTP 响应
         * @param filterChain 过滤器链
         * @throws ServletException Servlet 异常
         * @throws IOException      IO 异常
         */
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                throws ServletException, IOException {
            String uri = request.getRequestURI();
            String method = request.getMethod();
            boolean isSkillRoute = uri.startsWith("/api/skills");
            boolean isSystemSkillRoute = uri.startsWith("/api/system-skills");
            boolean isReadOnlySkillRequest = "GET".equalsIgnoreCase(method);
            boolean isEnumSource = uri.equals("/api/skills/enum-source") && "POST".equalsIgnoreCase(method);
            boolean internalAuditPost = uri.startsWith("/api/internal/llm-http-audit") && "POST".equalsIgnoreCase(method);
            boolean isPollingAudit = uri.startsWith("/api/internal/polling-audit") && "POST".equalsIgnoreCase(method);
            boolean needsToken = ((isSkillRoute && !isReadOnlySkillRequest) && !isEnumSource)
                    || (isSystemSkillRoute && !isReadOnlySkillRequest)
                    || internalAuditPost
                    || isPollingAudit;
            if (!needsToken) {
                filterChain.doFilter(request, response);
                return;
            }

            String token = request.getHeader(API_KEY_HEADER);
            if (!getValidToken().equals(token)) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid API Token");
                return;
            }

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            "agent-core",
                            null,
                            AuthorityUtils.createAuthorityList("ROLE_AGENT")
                    );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        }
    }
}

import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{
 const base=process.env.NEXT_PUBLIC_SITE_URL||'https://thepussyisyours.com';
 const live=process.env.NEXT_PUBLIC_ALLOW_INDEXING==='true';
 return {rules:live?[{userAgent:'*',allow:['/','/seo','/p/'],disallow:['/admin','/auth','/settings','/me','/messages']}]:[{userAgent:'*',disallow:'/'}],sitemap:live?`${base.replace(/\/$/,'')}/sitemap.xml`:undefined};
}
